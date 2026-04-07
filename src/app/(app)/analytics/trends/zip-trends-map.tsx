"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
    type MapRentTrendCityRow,
    type MapRentTrendCountyRow,
    type MapRentTrendMsaRow,
    type MapRentTrendNeighborhoodRow,
    type MapRentTrendZipRow,
    getMapRentTrends,
    getMapRentTrendsByCity,
    getMapRentTrendsByCounty,
    getMapRentTrendsByMsa,
    getMapRentTrendsByNeighborhood,
} from "@/db/rpc";
import { AreaSelection, BED_KEYS, formatDollars } from "./trends-utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

const PERIOD_OPTIONS = [
    { weeks: 4, label: "1m" },
    { weeks: 13, label: "3m" },
    { weeks: 26, label: "6m" },
    { weeks: 52, label: "1y" },
];

type ZipPoint = MapRentTrendZipRow;
type NhPoint = MapRentTrendNeighborhoodRow;
type CountyPoint = MapRentTrendCountyRow;
type MsaPoint = MapRentTrendMsaRow;
type CityPoint = MapRentTrendCityRow;

type MapPoint = ZipPoint | NhPoint | CountyPoint | MsaPoint | CityPoint;

function isNhPoint(p: MapPoint): p is NhPoint {
    return "neighborhood_id" in p;
}
function isCountyPoint(p: MapPoint): p is CountyPoint {
    return "county_name" in p;
}
function isMsaPoint(p: MapPoint): p is MsaPoint {
    return "geoid" in p;
}
function isCityPoint(p: MapPoint): p is CityPoint {
    return "city_name" in p;
}

interface Props {
    areaType: "ZIP Code" | "Neighborhood" | "County" | "MSA" | "City";
    selectedBeds: number;
    reitsOnly: boolean;
    selectedAreas: AreaSelection[];
    onAddZip: (zip: string) => void;
    onAddNeighborhood: (id: number, name: string, city: string) => void;
    onAddCounty: (name: string, state: string) => void;
    onAddMsa: (geoid: string, name: string) => void;
    onAddCity: (name: string, state: string) => void;
}

export function ZipTrendsMap({ areaType, selectedBeds, reitsOnly, selectedAreas, onAddZip, onAddNeighborhood, onAddCounty, onAddMsa, onAddCity }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const popupRef = useRef<mapboxgl.Popup | null>(null);
    const callbacksRef = useRef({ onAddZip, onAddNeighborhood, onAddCounty, onAddMsa, onAddCity });
    const [mapLoaded, setMapLoaded] = useState(false);
    const [weeksBack, setWeeksBack] = useState(13);
    const [data, setData] = useState<MapPoint[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        callbacksRef.current = { onAddZip, onAddNeighborhood, onAddCounty, onAddMsa, onAddCity };
    }, [onAddZip, onAddNeighborhood, onAddCounty, onAddMsa, onAddCity]);

    // Init map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const m = new mapboxgl.Map({
            container: containerRef.current,
            style: "mapbox://styles/mapbox/light-v11",
            center: [-122.2, 37.75],
            zoom: 8.5,
        });
        m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
        m.on("load", () => setMapLoaded(true));
        mapRef.current = m;
        return () => {
            m.remove();
            mapRef.current = null;
            setMapLoaded(false);
        };
    }, []);

    // Fetch data when params change
    useEffect(() => {
        setLoading(true);
        setData([]);
        const params = { p_beds: selectedBeds, p_weeks_back: weeksBack, p_reits_only: reitsOnly };
        const fetcher: () => Promise<MapPoint[]> =
            areaType === "Neighborhood"
                ? () => getMapRentTrendsByNeighborhood(params)
                : areaType === "County"
                  ? () => getMapRentTrendsByCounty(params)
                  : areaType === "MSA"
                    ? () => getMapRentTrendsByMsa(params)
                    : areaType === "City"
                      ? () => getMapRentTrendsByCity(params)
                      : () => getMapRentTrends(params);
        fetcher()
            .then((rows) => {
                setLoading(false);
                setData(rows);
            })
            .catch(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [areaType, selectedBeds, weeksBack, reitsOnly]);

    // Build/update map layers
    useEffect(() => {
        const m = mapRef.current;
        if (!m || !mapLoaded) return;

        const selectedIds = new Set(selectedAreas.map((a) => a.id));

        const geojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: data.map((d) => {
                let props: Record<string, unknown>;
                if (isNhPoint(d)) {
                    const id = `nh:${d.neighborhood_id}`;
                    props = {
                        _id: id,
                        _type: "neighborhood",
                        neighborhood_id: d.neighborhood_id,
                        _name: d.name,
                        _city: d.city,
                        label: `${d.name} · ${d.city}`,
                        pct_change: d.pct_change ?? null,
                        current_median: d.current_median,
                        listing_count: d.listing_count,
                        selected: selectedIds.has(id),
                    };
                } else if (isCountyPoint(d)) {
                    const id = `county:${d.county_name}:${d.state}`;
                    props = {
                        _id: id,
                        _type: "county",
                        _name: d.county_name,
                        _state: d.state,
                        label: `${d.county_name}, ${d.state}`,
                        pct_change: d.pct_change ?? null,
                        current_median: d.current_median,
                        listing_count: d.listing_count,
                        selected: selectedIds.has(id),
                    };
                } else if (isMsaPoint(d)) {
                    const id = `msa:${d.geoid}`;
                    props = {
                        _id: id,
                        _type: "msa",
                        _geoid: d.geoid,
                        _name: d.name,
                        label: d.name,
                        pct_change: d.pct_change ?? null,
                        current_median: d.current_median,
                        listing_count: d.listing_count,
                        selected: selectedIds.has(id),
                    };
                } else if (isCityPoint(d)) {
                    const id = `city:${d.city_name}:${d.state}`;
                    props = {
                        _id: id,
                        _type: "city",
                        _name: d.city_name,
                        _state: d.state,
                        label: `${d.city_name}, ${d.state}`,
                        pct_change: d.pct_change ?? null,
                        current_median: d.current_median,
                        listing_count: d.listing_count,
                        selected: selectedIds.has(id),
                    };
                } else {
                    props = {
                        _id: d.zip,
                        _type: "zip",
                        _zip: d.zip,
                        label: d.zip,
                        pct_change: d.pct_change ?? null,
                        current_median: d.current_median,
                        listing_count: d.listing_count,
                        selected: selectedIds.has(d.zip),
                    };
                }
                return { type: "Feature", geometry: JSON.parse(d.geom_json) as GeoJSON.Geometry, properties: props };
            }),
        };

        const source = m.getSource("zip-trends") as mapboxgl.GeoJSONSource | undefined;
        if (source) {
            source.setData(geojson);
            m.moveLayer("zip-border");
            return;
        }

        m.addSource("zip-trends", { type: "geojson", data: geojson });

        // Fill layer
        m.addLayer({
            id: "zip-fill",
            type: "fill",
            source: "zip-trends",
            paint: {
                "fill-color": [
                    "case",
                    ["==", ["get", "pct_change"], null],
                    "#e5e7eb",
                    ["interpolate", ["linear"], ["get", "pct_change"], -10, "#dc2626", -3, "#fca5a5", 0, "#f3f4f6", 3, "#86efac", 10, "#16a34a"],
                ],
                "fill-opacity": ["case", ["boolean", ["get", "selected"], false], 0.85, 0.65],
            },
        });

        // Border layer
        m.addLayer({
            id: "zip-border",
            type: "line",
            source: "zip-trends",
            paint: {
                "line-color": ["case", ["boolean", ["get", "selected"], false], "#1d4ed8", "rgba(0,0,0,0.15)"],
                "line-width": ["case", ["boolean", ["get", "selected"], false], 2, 0.5],
            },
        });

        m.on("mousemove", "zip-fill", (e) => {
            m.getCanvas().style.cursor = "pointer";
            const f = e.features?.[0];
            if (!f) return;
            const p = f.properties as { label: string; pct_change: number | null; current_median: number; listing_count: number };
            const pct =
                p.pct_change != null
                    ? `<span style="color:${p.pct_change >= 0 ? "#16a34a" : "#dc2626"};font-weight:600">${p.pct_change >= 0 ? "+" : ""}${p.pct_change}%</span>`
                    : '<span style="color:#9ca3af">—</span>';
            popupRef.current
                ?.setLngLat(e.lngLat)
                .setHTML(
                    `
                    <div style="font-family:system-ui;font-size:13px;line-height:1.6;padding:2px 0">
                        <div style="font-weight:600;margin-bottom:1px">${p.label}</div>
                        <div>${formatDollars(p.current_median)}/mo &nbsp;·&nbsp; ${pct}</div>
                        <div style="color:#9ca3af;font-size:11px">${p.listing_count} listing${p.listing_count !== 1 ? "s" : ""}</div>
                        <div style="color:#3b82f6;font-size:11px;margin-top:3px">Click to compare</div>
                    </div>
                `,
                )
                .addTo(m);
        });

        m.on("mouseleave", "zip-fill", () => {
            m.getCanvas().style.cursor = "";
            popupRef.current?.remove();
        });

        m.on("click", "zip-fill", (e) => {
            const props = e.features?.[0]?.properties as
                | { _type: string; _zip?: string; neighborhood_id?: number; _name?: string; _city?: string; _state?: string; _geoid?: string }
                | undefined;
            if (!props) return;
            if (props._type === "neighborhood" && props.neighborhood_id != null) {
                callbacksRef.current.onAddNeighborhood(props.neighborhood_id, props._name ?? "", props._city ?? "");
            } else if (props._type === "county" && props._name && props._state) {
                callbacksRef.current.onAddCounty(props._name, props._state);
            } else if (props._type === "msa" && props._geoid && props._name) {
                callbacksRef.current.onAddMsa(props._geoid, props._name);
            } else if (props._type === "city" && props._name && props._state) {
                callbacksRef.current.onAddCity(props._name, props._state);
            } else if (props._type === "zip" && props._zip) {
                callbacksRef.current.onAddZip(props._zip);
            }
        });
    }, [data, selectedAreas, mapLoaded]);

    const bed = BED_KEYS.find((b) => b.beds === selectedBeds)!;

    return (
        <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rent trend · {bed.label}</span>
                    {loading && <span className="text-xs text-gray-400">Loading…</span>}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <span style={{ color: "#dc2626" }}>▼</span>
                        <div className="h-2 w-20 rounded" style={{ background: "linear-gradient(to right, #dc2626, #f3f4f6, #16a34a)" }} />
                        <span style={{ color: "#16a34a" }}>▲</span>
                    </div>
                    <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs dark:border-gray-600">
                        {PERIOD_OPTIONS.map((opt, i) => (
                            <button
                                key={opt.weeks}
                                type="button"
                                onClick={() => setWeeksBack(opt.weeks)}
                                className={`px-2.5 py-1.5 transition-colors ${i > 0 ? "border-l border-gray-200 dark:border-gray-600" : ""} ${weeksBack === opt.weeks ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div ref={containerRef} className="h-[520px] w-full" />
            {data.length > 0 && (
                <p className="border-t border-gray-100 px-5 py-2 text-xs text-gray-400 dark:border-gray-700">
                    {data.length}{" "}
                    {areaType === "Neighborhood"
                        ? "neighborhoods"
                        : areaType === "County"
                          ? "counties"
                          : areaType === "MSA"
                            ? "metros"
                            : areaType === "City"
                              ? "cities"
                              : "zip codes"}{" "}
                    · click a region to add to comparison
                </p>
            )}
        </div>
    );
}
