"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot } from "react-dom/client";
import { PropertyPopupContent } from "./property-popup-content";

mapboxgl.accessToken = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

export type ListingSource = "loopnet" | "zillow";

export interface UnitMixRow {
    beds: number | null;
    baths: number | null;
    count: number;
    avgPrice: number | null;
}

export interface Property {
    id: string | number;
    name: string;
    address: string;
    location?: string | null;
    units?: number | null;
    price: string;
    coordinates: [number, number];
    thumbnailUrl?: string | null;
    capRate?: string | null;
    squareFootage?: string | null;
    listingSource?: ListingSource | null;
    isReit?: boolean;
    unitMix?: UnitMixRow[];
    buildingZpid?: string | null;
}

export type MapBounds = { north: number; south: number; east: number; west: number };

interface MapProps {
    className?: string;
    properties: Property[];
    selectedId?: string | number | null;
    initialCenter?: [number, number];
    initialZoom?: number;
    fitBoundsTarget?: MapBounds | null;
    boundaryGeoJSON?: string | null;
    addressPin?: [number, number] | null;
    onBoundsChange?: (bounds: MapBounds) => void;
    onViewChange?: (lat: number, lng: number, zoom: number) => void;
}

const BOUNDARY_SOURCE = "area-boundary";
const BOUNDARY_FILL = "area-boundary-fill";
const BOUNDARY_LINE = "area-boundary-line";
const PROPERTIES_SOURCE = "properties";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const UNCLUSTERED_LAYER = "unclustered-point";

function propertiesToGeoJSON(properties: Property[]): GeoJSON.FeatureCollection {
    return {
        type: "FeatureCollection",
        features: properties.map((p) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: p.coordinates },
            properties: {
                id: p.id,
                name: p.name,
                address: p.address,
                price: p.price,
                units: p.units ?? null,
                capRate: p.capRate ?? null,
                squareFootage: p.squareFootage ?? null,
                thumbnailUrl: p.thumbnailUrl ?? null,
                listingSource: p.listingSource ?? null,
                isReit: p.isReit ?? false,
                unitMix: JSON.stringify(p.unitMix ?? []),
                buildingZpid: p.buildingZpid ?? null,
            },
        })),
    };
}

export const PropertyMap = ({
    className,
    properties,
    selectedId,
    initialCenter,
    initialZoom,
    fitBoundsTarget,
    boundaryGeoJSON,
    addressPin,
    onBoundsChange,
    onViewChange,
}: MapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const popup = useRef<mapboxgl.Popup | null>(null);
    const popupRoot = useRef<ReturnType<typeof createRoot> | null>(null);
    const popupContainer = useRef<HTMLDivElement | null>(null);
    const addressMarker = useRef<mapboxgl.Marker | null>(null);
    const onBoundsChangeRef = useRef(onBoundsChange);
    const onViewChangeRef = useRef(onViewChange);
    const propertiesRef = useRef(properties);

    useEffect(() => {
        onBoundsChangeRef.current = onBoundsChange;
    });
    useEffect(() => {
        onViewChangeRef.current = onViewChange;
    });
    useEffect(() => {
        propertiesRef.current = properties;
    });

    // fitBounds
    useEffect(() => {
        if (!fitBoundsTarget || !map.current) return;
        const { west, south, east, north } = fitBoundsTarget;
        map.current.fitBounds(
            [
                [west, south],
                [east, north],
            ],
            { padding: 40, duration: 600 },
        );
    }, [fitBoundsTarget]);

    // Boundary GeoJSON overlay
    useEffect(() => {
        if (!map.current) return;
        const apply = () => {
            const m = map.current;
            if (!m) return;
            if (!boundaryGeoJSON) {
                if (m.getLayer(BOUNDARY_LINE)) m.removeLayer(BOUNDARY_LINE);
                if (m.getLayer(BOUNDARY_FILL)) m.removeLayer(BOUNDARY_FILL);
                if (m.getSource(BOUNDARY_SOURCE)) m.removeSource(BOUNDARY_SOURCE);
                return;
            }
            const data: GeoJSON.Feature = { type: "Feature", geometry: JSON.parse(boundaryGeoJSON), properties: {} };
            if (m.getSource(BOUNDARY_SOURCE)) {
                (m.getSource(BOUNDARY_SOURCE) as mapboxgl.GeoJSONSource).setData(data);
            } else {
                m.addSource(BOUNDARY_SOURCE, { type: "geojson", data });
                m.addLayer({
                    id: BOUNDARY_FILL,
                    type: "fill",
                    source: BOUNDARY_SOURCE,
                    paint: { "fill-color": "#3b82f6", "fill-opacity": 0.08 },
                });
                m.addLayer({
                    id: BOUNDARY_LINE,
                    type: "line",
                    source: BOUNDARY_SOURCE,
                    paint: { "line-color": "#3b82f6", "line-width": 2, "line-opacity": 0.6 },
                });
            }
        };
        if (map.current.isStyleLoaded()) {
            apply();
        } else {
            map.current.once("load", apply);
        }
    }, [boundaryGeoJSON]);

    // Address pin marker
    useEffect(() => {
        if (!map.current) return;
        if (addressMarker.current) {
            addressMarker.current.remove();
            addressMarker.current = null;
        }
        if (!addressPin) return;
        const el = document.createElement("div");
        el.style.cssText =
            "width:28px;height:38px;background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 38'%3E%3Cellipse cx='14' cy='35' rx='6' ry='3' fill='rgba(0,0,0,0.18)'/%3E%3Cpath d='M14 2C8.48 2 4 6.48 4 12c0 7.25 10 22 10 22S24 19.25 24 12c0-5.52-4.48-10-10-10z' fill='%232563eb'/%3E%3Ccircle cx='14' cy='12' r='4' fill='white'/%3E%3C/svg%3E\") center/contain no-repeat;cursor:default;";
        addressMarker.current = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat(addressPin).addTo(map.current);
    }, [addressPin]);

    // Map initialisation
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        const m = new mapboxgl.Map({
            container: mapContainer.current,
            style: "mapbox://styles/mapbox/light-v11",
            center: initialCenter ?? [-122.4194, 37.7749],
            zoom: initialZoom ?? 10,
        });
        map.current = m;

        m.addControl(new mapboxgl.NavigationControl(), "top-right");

        const reportBounds = () => {
            const b = m.getBounds()!;
            onBoundsChangeRef.current?.({
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest(),
            });
            const center = m.getCenter();
            onViewChangeRef.current?.(center.lat, center.lng, m.getZoom());
        };

        m.on("moveend", reportBounds);

        m.on("load", () => {
            m.resize();
            reportBounds();

            // Add clustered GeoJSON source
            m.addSource(PROPERTIES_SOURCE, {
                type: "geojson",
                data: propertiesToGeoJSON(propertiesRef.current),
                cluster: true,
                clusterMaxZoom: 11,
                clusterRadius: 50,
            });

            // Cluster circles
            m.addLayer({
                id: CLUSTER_LAYER,
                type: "circle",
                source: PROPERTIES_SOURCE,
                filter: ["has", "point_count"],
                paint: {
                    "circle-color": ["step", ["get", "point_count"], "#0ea5e9", 10, "#f97316", 50, "#ef4444"],
                    "circle-radius": ["step", ["get", "point_count"], 16, 10, 24, 50, 34],
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "#fff",
                    "circle-opacity": 0.9,
                },
            });

            // Cluster count labels
            m.addLayer({
                id: CLUSTER_COUNT_LAYER,
                type: "symbol",
                source: PROPERTIES_SOURCE,
                filter: ["has", "point_count"],
                layout: {
                    "text-field": "{point_count_abbreviated}",
                    "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                    "text-size": 13,
                },
                paint: {
                    "text-color": "#ffffff",
                },
            });

            // Individual (unclustered) points
            m.addLayer({
                id: UNCLUSTERED_LAYER,
                type: "circle",
                source: PROPERTIES_SOURCE,
                filter: ["!", ["has", "point_count"]],
                paint: {
                    "circle-color": ["case", ["==", ["get", "listingSource"], "zillow"], "#f97316", "#0ea5e9"],
                    "circle-radius": 8,
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "#fff",
                    "circle-opacity": 0.95,
                },
            });

            // Click cluster → zoom in
            m.on("click", CLUSTER_LAYER, (e) => {
                const features = m.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
                if (!features.length) return;
                const clusterId = features[0].properties?.cluster_id as number;
                (m.getSource(PROPERTIES_SOURCE) as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err || zoom == null) return;
                    const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
                    m.easeTo({ center: coords, zoom });
                });
            });

            // Click unclustered point → show popup
            m.on("click", UNCLUSTERED_LAYER, (e) => {
                if (!e.features?.length) return;
                const feature = e.features[0];
                const props = feature.properties!;
                const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

                // Reuse or create popup container & React root
                if (!popupContainer.current) {
                    popupContainer.current = document.createElement("div");
                }
                if (!popupRoot.current) {
                    popupRoot.current = createRoot(popupContainer.current);
                }

                let unitMix: UnitMixRow[] = [];
                try {
                    unitMix = JSON.parse(props.unitMix ?? "[]");
                } catch {}

                const popupHref =
                    props.isReit && props.buildingZpid ? `/analytics/building/${encodeURIComponent(props.buildingZpid)}` : `/analytics/listing/${props.id}`;

                popupRoot.current.render(
                    <PropertyPopupContent
                        name={props.name}
                        address={props.address}
                        price={props.price}
                        units={props.units}
                        capRate={props.capRate}
                        squareFootage={props.squareFootage}
                        thumbnailUrl={props.thumbnailUrl}
                        isReit={props.isReit}
                        unitMix={unitMix}
                        href={popupHref}
                    />,
                );

                if (popup.current) popup.current.remove();
                popup.current = new mapboxgl.Popup({ offset: 12, className: "property-popup", closeButton: false })
                    .setLngLat(coords)
                    .setDOMContent(popupContainer.current)
                    .addTo(m);
            });

            // Pointer cursor changes
            m.on("mouseenter", CLUSTER_LAYER, () => (m.getCanvas().style.cursor = "pointer"));
            m.on("mouseleave", CLUSTER_LAYER, () => (m.getCanvas().style.cursor = ""));
            m.on("mouseenter", UNCLUSTERED_LAYER, () => (m.getCanvas().style.cursor = "pointer"));
            m.on("mouseleave", UNCLUSTERED_LAYER, () => (m.getCanvas().style.cursor = ""));
        });

        return () => {
            popup.current?.remove();
            popupRoot.current?.unmount();
            popupRoot.current = null;
            popupContainer.current = null;
            addressMarker.current?.remove();
            addressMarker.current = null;
            m.remove();
            map.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Update GeoJSON data when properties change
    useEffect(() => {
        if (!map.current) return;
        const src = map.current.getSource(PROPERTIES_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        if (!src) return;
        src.setData(propertiesToGeoJSON(properties));
        // Close any open popup since it may belong to a stale feature
        popup.current?.remove();
    }, [properties]);

    // Handle external selection (fly to + open popup)
    useEffect(() => {
        if (!map.current || !selectedId) return;

        const property = properties.find((p) => p.id === selectedId);
        if (!property) return;

        map.current.flyTo({ center: property.coordinates, zoom: 14, essential: true });

        // Show popup after fly
        const showSelectedPopup = () => {
            if (!map.current) return;

            if (!popupContainer.current) {
                popupContainer.current = document.createElement("div");
            }
            if (!popupRoot.current) {
                popupRoot.current = createRoot(popupContainer.current);
            }

            const selectedPopupHref =
                property.isReit && property.buildingZpid
                    ? `/analytics/building/${encodeURIComponent(property.buildingZpid)}`
                    : `/analytics/listing/${property.id}`;

            popupRoot.current.render(
                <PropertyPopupContent
                    name={property.name}
                    address={property.address}
                    price={property.price}
                    units={property.units}
                    capRate={property.capRate}
                    squareFootage={property.squareFootage}
                    thumbnailUrl={property.thumbnailUrl}
                    isReit={property.isReit}
                    unitMix={property.unitMix}
                    href={selectedPopupHref}
                />,
            );

            if (popup.current) popup.current.remove();
            popup.current = new mapboxgl.Popup({ offset: 12, className: "property-popup", closeButton: false })
                .setLngLat(property.coordinates)
                .setDOMContent(popupContainer.current)
                .addTo(map.current);
        };

        map.current.once("moveend", showSelectedPopup);
    }, [selectedId, properties]);

    return (
        <div className={className} style={{ position: "relative", width: "100%", height: "100%", minHeight: "400px" }}>
            <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
        </div>
    );
};
