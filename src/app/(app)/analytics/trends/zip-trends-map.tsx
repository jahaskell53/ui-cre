"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/utils/supabase";
import { BED_KEYS, AreaSelection, formatDollars } from "./trends-utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

const PERIOD_OPTIONS = [
    { weeks: 4,  label: "1m" },
    { weeks: 13, label: "3m" },
    { weeks: 26, label: "6m" },
    { weeks: 52, label: "1y" },
];

interface MapTrendPoint {
    zip: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

interface Props {
    selectedBeds: number;
    reitsOnly: boolean;
    selectedAreas: AreaSelection[];
    onAddArea: (zip: string) => void;
}

export function ZipTrendsMap({ selectedBeds, reitsOnly, selectedAreas, onAddArea }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const popupRef = useRef<mapboxgl.Popup | null>(null);
    const onAddAreaRef = useRef(onAddArea);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [weeksBack, setWeeksBack] = useState(13);
    const [data, setData] = useState<MapTrendPoint[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { onAddAreaRef.current = onAddArea; }, [onAddArea]);

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
        return () => { m.remove(); mapRef.current = null; setMapLoaded(false); };
    }, []);

    // Fetch data
    useEffect(() => {
        setLoading(true);
        supabase
            .rpc("get_map_rent_trends", { p_beds: selectedBeds, p_weeks_back: weeksBack, p_reits_only: reitsOnly })
            .then(({ data: rows, error }) => {
                setLoading(false);
                if (!error && rows) setData(rows as MapTrendPoint[]);
            });
    }, [selectedBeds, weeksBack, reitsOnly]);

    // Build/update map layers
    useEffect(() => {
        const m = mapRef.current;
        if (!m || !mapLoaded) return;

        const selectedZips = new Set(selectedAreas.map(a => a.zip));

        const geojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: data.map(d => ({
                type: "Feature",
                geometry: JSON.parse(d.geom_json) as GeoJSON.Geometry,
                properties: {
                    zip: d.zip,
                    pct_change: d.pct_change ?? null,
                    current_median: d.current_median,
                    listing_count: d.listing_count,
                    selected: selectedZips.has(d.zip),
                },
            })),
        };

        const source = m.getSource("zip-trends") as mapboxgl.GeoJSONSource | undefined;
        if (source) {
            source.setData(geojson);
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
                    ["==", ["get", "pct_change"], null], "#e5e7eb",
                    [
                        "interpolate", ["linear"], ["get", "pct_change"],
                        -10, "#dc2626",
                        -3,  "#fca5a5",
                         0,  "#f3f4f6",
                         3,  "#86efac",
                        10,  "#16a34a",
                    ],
                ],
                "fill-opacity": [
                    "case",
                    ["boolean", ["get", "selected"], false], 0.85,
                    0.65,
                ],
            },
        });

        // Border layer
        m.addLayer({
            id: "zip-border",
            type: "line",
            source: "zip-trends",
            paint: {
                "line-color": [
                    "case",
                    ["boolean", ["get", "selected"], false], "#1d4ed8",
                    "rgba(0,0,0,0.15)",
                ],
                "line-width": [
                    "case",
                    ["boolean", ["get", "selected"], false], 2,
                    0.5,
                ],
            },
        });

        // Hover — update content + position on every move so it tracks across zip boundaries
        m.on("mousemove", "zip-fill", (e) => {
            m.getCanvas().style.cursor = "pointer";
            const f = e.features?.[0];
            if (!f) return;
            const p = f.properties as { zip: string; pct_change: number | null; current_median: number; listing_count: number };
            const pct = p.pct_change != null
                ? `<span style="color:${p.pct_change >= 0 ? "#16a34a" : "#dc2626"};font-weight:600">${p.pct_change >= 0 ? "+" : ""}${p.pct_change}%</span>`
                : '<span style="color:#9ca3af">—</span>';
            popupRef.current
                ?.setLngLat(e.lngLat)
                .setHTML(`
                    <div style="font-family:system-ui;font-size:13px;line-height:1.6;padding:2px 0">
                        <div style="font-weight:600;margin-bottom:1px">${p.zip}</div>
                        <div>${formatDollars(p.current_median)}/mo &nbsp;·&nbsp; ${pct}</div>
                        <div style="color:#9ca3af;font-size:11px">${p.listing_count} listing${p.listing_count !== 1 ? "s" : ""}</div>
                    </div>
                `)
                .addTo(m);
        });

        m.on("mouseleave", "zip-fill", () => {
            m.getCanvas().style.cursor = "";
            popupRef.current?.remove();
        });

        m.on("click", "zip-fill", (e) => {
            const zip = e.features?.[0]?.properties?.zip as string | undefined;
            if (zip) onAddAreaRef.current(zip);
        });
    }, [data, selectedAreas, mapLoaded]);

    const bed = BED_KEYS.find(b => b.beds === selectedBeds)!;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rent trend · {bed.label}</span>
                    {loading && <span className="text-xs text-gray-400">Loading…</span>}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <span style={{ color: "#dc2626" }}>▼</span>
                        <div className="w-20 h-2 rounded" style={{ background: "linear-gradient(to right, #dc2626, #f3f4f6, #16a34a)" }} />
                        <span style={{ color: "#16a34a" }}>▲</span>
                    </div>
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs">
                        {PERIOD_OPTIONS.map((opt, i) => (
                            <button
                                key={opt.weeks}
                                type="button"
                                onClick={() => setWeeksBack(opt.weeks)}
                                className={`px-2.5 py-1.5 transition-colors ${i > 0 ? "border-l border-gray-200 dark:border-gray-600" : ""} ${weeksBack === opt.weeks ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div ref={containerRef} className="h-[520px] w-full" />
            {data.length > 0 && (
                <p className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
                    {data.length} zip codes · click a region to add to comparison
                </p>
            )}
        </div>
    );
}
