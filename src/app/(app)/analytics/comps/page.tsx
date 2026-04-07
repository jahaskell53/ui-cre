"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Building2, MapPin, Search } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRouter, useSearchParams } from "next/navigation";
import { createRoot } from "react-dom/client";
import { ListingDetailContent } from "@/components/application/listing-detail-content";
import { PropertyPopupContent } from "@/components/application/map/property-popup-content";
import { PaginationButtonGroup } from "@/components/application/pagination/pagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findNeighborhood, getAdjacentNeighborhoodsBatch, getComps, getZipBoundary } from "@/db/rpc";
import {
    buildMarketStats,
    getGeomBounds,
    getScoreColor,
    makeCircle,
    metersToMiles,
    sortCompResults,
    titleCaseAddress,
    type CompSortColumn,
} from "@/lib/analytics/comps";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

const USER_LOCATION_STORAGE_KEY = "userLocation";
const LOCATION_DECLINED_STORAGE_KEY = "compsGeolocationDeclined";

interface CompResult {
    id: string;
    address_raw: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    area: number | null;
    latitude: number | null;
    longitude: number | null;
    distance_m: number;
    composite_score: number;
    building_zpid: string | null;
    unit_count: number;
    img_src: string | null;
}

interface MapboxFeature {
    id: string;
    place_name: string;
    center: [number, number];
    context?: Array<{ id: string; text: string }>;
}

type NhData = { id: number; name: string; city: string; geojson: string };

interface SearchParams {
    addr: string;
    coords: [number, number] | null;
    radius: number;
    price: string;
    beds: string;
    baths: string;
    area: string;
    segment: "mid" | "reit" | "both";
    filterMode: "radius" | "neighborhood";
    zip?: string | null;
}

function CompsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Read initial values from URL
    const initAddress = searchParams.get("address") ?? "";
    const initLat = searchParams.get("lat");
    const initLng = searchParams.get("lng");
    const initCoords: [number, number] | null = initLat && initLng ? [parseFloat(initLng), parseFloat(initLat)] : null;
    const initRadius = parseFloat(searchParams.get("radius") ?? "2");
    const initPrice = searchParams.get("price") ?? "";
    const initBeds = searchParams.get("beds") ?? "";
    const initBaths = searchParams.get("baths") ?? "";
    const initArea = searchParams.get("area") ?? "";
    const rawSegment = searchParams.get("segment");
    const initSegment: "mid" | "reit" | "both" = rawSegment === "mid" || rawSegment === "reit" || rawSegment === "both" ? rawSegment : "both";
    const initFilterMode = (searchParams.get("filterMode") ?? "radius") as "radius" | "neighborhood";
    const initZip = searchParams.get("zip") ?? null;

    const [address, setAddress] = useState(initAddress);
    const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(initCoords);
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [radiusMiles, setRadiusMiles] = useState(initRadius);
    const [subjectPrice, setSubjectPrice] = useState(initPrice);
    const [subjectBeds, setSubjectBeds] = useState(initBeds);
    const [subjectBaths, setSubjectBaths] = useState(initBaths);
    const [subjectArea, setSubjectArea] = useState(initArea);

    const [rentSegment, setRentSegment] = useState<"mid" | "reit" | "both">(initSegment);
    const [filterMode, setFilterMode] = useState<"radius" | "neighborhood">(initFilterMode);
    const [neighborhoodName, setNeighborhoodName] = useState<string | null>(null);
    const [selectedNhIds, setSelectedNhIds] = useState<number[]>([]);
    const [candidateNhIds, setCandidateNhIds] = useState<number[]>([]);
    const [nhDataCache, setNhDataCache] = useState<Record<number, NhData>>({});
    const [zipGeoJSON, setZipGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
    const [cachedZip, setCachedZip] = useState<string | null>(initZip);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [comps, setComps] = useState<CompResult[] | null>(null);
    const [compsPage, setCompsPage] = useState(1);
    const [sortCol, setSortCol] = useState<CompSortColumn | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [subjectLabel, setSubjectLabel] = useState<string | null>(initAddress || null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(() => {
        try {
            if (typeof window === "undefined") return null;
            if (localStorage.getItem(LOCATION_DECLINED_STORAGE_KEY) === "1") return null;
            const cached = localStorage.getItem(USER_LOCATION_STORAGE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    });
    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const miniMapContainerRef = useRef<HTMLDivElement>(null);
    const miniMapInstance = useRef<mapboxgl.Map | null>(null);
    const miniMapCompMarkersRef = useRef<mapboxgl.Marker[]>([]);
    const miniMapPopupRootsRef = useRef<ReturnType<typeof createRoot>[]>([]);
    const didAutoSearch = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const searchGenRef = useRef(0);
    const hasSearchedRef = useRef(false);
    const [miniMapActiveIndex, setMiniMapActiveIndex] = useState<number | null>(null);
    const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
    const selectedNhIdsRef = useRef<number[]>([]);
    const nhDataCacheRef = useRef<Record<number, NhData>>({});
    const toggleNhRef = useRef<((id: number, action: "add" | "remove") => void) | null>(null);
    const lastNhDetectedRef = useRef<{ lng: number; lat: number } | null>(null);
    const nhFittedRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined" || !navigator.geolocation) return;
        try {
            if (localStorage.getItem(LOCATION_DECLINED_STORAGE_KEY) === "1") return;
            if (localStorage.getItem(USER_LOCATION_STORAGE_KEY)) return;
        } catch {
            return;
        }

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const loc: [number, number] = [coords.longitude, coords.latitude];
                setUserLocation(loc);
                try {
                    localStorage.setItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(loc));
                    localStorage.removeItem(LOCATION_DECLINED_STORAGE_KEY);
                } catch {}
            },
            () => {
                try {
                    localStorage.setItem(LOCATION_DECLINED_STORAGE_KEY, "1");
                    localStorage.removeItem(USER_LOCATION_STORAGE_KEY);
                } catch {}
            },
        );
    }, []);

    // Sync refs to avoid stale closures in map event handlers
    useEffect(() => {
        selectedNhIdsRef.current = selectedNhIds;
    }, [selectedNhIds]);
    useEffect(() => {
        nhDataCacheRef.current = nhDataCache;
    }, [nhDataCache]);

    const makeFC = (ids: number[], cache: Record<number, NhData>): GeoJSON.FeatureCollection => ({
        type: "FeatureCollection",
        features: ids
            .filter((id) => cache[id])
            .map((id) => ({
                type: "Feature" as const,
                geometry: JSON.parse(cache[id].geojson) as GeoJSON.Geometry,
                properties: { id, name: cache[id].name },
            })),
    });
    const selectedNhFC = useMemo(() => makeFC(selectedNhIds, nhDataCache), [selectedNhIds, nhDataCache]);
    const candidateNhFC = useMemo(() => makeFC(candidateNhIds, nhDataCache), [candidateNhIds, nhDataCache]);

    const refreshCandidates = useCallback(async (ids: number[]) => {
        if (!ids.length) return;
        const data = await getAdjacentNeighborhoodsBatch({ p_ids: ids });
        setNhDataCache((prev) => {
            const next = { ...prev };
            data.forEach((r) => {
                next[r.id] = r;
            });
            return next;
        });
        setCandidateNhIds(data.map((r) => r.id));
    }, []);

    // Persist search params to URL without adding a history entry
    const pushToUrl = useCallback(
        (p: SearchParams) => {
            const url = new URLSearchParams();
            if (p.addr) url.set("address", p.addr);
            if (p.coords) {
                url.set("lng", String(p.coords[0]));
                url.set("lat", String(p.coords[1]));
            }
            url.set("radius", String(p.radius));
            if (p.price) url.set("price", p.price);
            if (p.beds) url.set("beds", p.beds);
            if (p.baths) url.set("baths", p.baths);
            if (p.area) url.set("area", p.area);
            url.set("segment", p.segment);
            if (p.filterMode !== "radius") url.set("filterMode", p.filterMode);
            if (p.zip) url.set("zip", p.zip);
            router.replace(`/analytics/comps?${url.toString()}`, { scroll: false });
        },
        [router],
    );

    const runSearch = useCallback(
        async (p: SearchParams) => {
            if (!p.addr.trim()) return;
            if (!p.beds.trim() || !p.baths.trim()) return;

            // Cancel any in-flight search
            abortControllerRef.current?.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;
            const gen = ++searchGenRef.current;

            hasSearchedRef.current = true;
            setLoading(true);
            setError(null);
            setComps(null);
            try {
                let lng: number, lat: number;
                let geocodedZip: string | null = p.zip ?? null;
                if (p.coords) {
                    [lng, lat] = p.coords;
                    if (geocodedZip) setCachedZip(geocodedZip);
                } else {
                    const geoRes = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(p.addr.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=1`,
                        { signal: controller.signal },
                    );
                    const geoData = await geoRes.json();
                    if (!geoData.features?.length) {
                        if (gen !== searchGenRef.current) return;
                        setError("Address not found. Please try a different address.");
                        setLoading(false);
                        return;
                    }
                    [lng, lat] = geoData.features[0].center as [number, number];
                    const label = geoData.features[0].place_name as string;
                    setSubjectLabel(label);
                    setSelectedCoords([lng, lat]);
                    const postcodeCtx = (geoData.features[0].context as Array<{ id: string; text: string }> | undefined)?.find((c) =>
                        c.id.startsWith("postcode."),
                    );
                    geocodedZip = postcodeCtx?.text ?? null;
                    if (geocodedZip) setCachedZip(geocodedZip);
                }

                if (gen !== searchGenRef.current) return;

                // Neighborhood lookup when in neighborhood mode
                let nhIdsForSearch: number[] | null = null;
                let subjectZip: string | null = null;
                if (p.filterMode === "neighborhood") {
                    const same = lastNhDetectedRef.current?.lng === lng && lastNhDetectedRef.current?.lat === lat;
                    if (same && selectedNhIdsRef.current.length > 0) {
                        nhIdsForSearch = selectedNhIdsRef.current;
                        refreshCandidates(nhIdsForSearch);
                    } else {
                        const nhData = await findNeighborhood({ p_lng: lng, p_lat: lat });
                        if (gen !== searchGenRef.current) return;
                        if (nhData.length > 0) {
                            const nhId = nhData[0].id;
                            nhIdsForSearch = [nhId];
                            lastNhDetectedRef.current = { lng, lat };
                            nhFittedRef.current = false;
                            const newCache: Record<number, NhData> = {
                                [nhId]: { id: nhId, name: nhData[0].name, city: nhData[0].city, geojson: nhData[0].geojson },
                            };
                            setNhDataCache(newCache);
                            nhDataCacheRef.current = newCache;
                            setSelectedNhIds([nhId]);
                            selectedNhIdsRef.current = [nhId];
                            setCandidateNhIds([]);
                            setZipGeoJSON(null);
                            setNeighborhoodName(`${nhData[0].name}, ${nhData[0].city}`);
                            refreshCandidates([nhId]);
                        } else {
                            // No neighborhood found — fall back to ZIP code
                            setSelectedNhIds([]);
                            setCandidateNhIds([]);
                            setNhDataCache({});
                            selectedNhIdsRef.current = [];
                            lastNhDetectedRef.current = null;
                            subjectZip = geocodedZip ?? cachedZip;
                            setNeighborhoodName(subjectZip ? `ZIP ${subjectZip}` : null);
                            setZipGeoJSON(null);
                            if (subjectZip) {
                                getZipBoundary({ p_zip: subjectZip })
                                    .then((data) => {
                                        if (data)
                                            setZipGeoJSON({
                                                type: "FeatureCollection",
                                                features: [{ type: "Feature", geometry: JSON.parse(data), properties: { zip: subjectZip } }],
                                            });
                                    })
                                    .catch(() => {});
                            }
                        }
                    }
                }

                let compsData: Omit<CompResult, "img_src" | "latitude" | "longitude">[];
                try {
                    compsData = (await getComps({
                        subject_lng: lng,
                        subject_lat: lat,
                        radius_m: p.radius * 1609.34,
                        subject_price: p.price ? parseInt(p.price) : null,
                        subject_beds: p.beds ? parseInt(p.beds) : null,
                        subject_baths: p.baths ? parseFloat(p.baths) : null,
                        subject_area: p.area ? parseInt(p.area) : null,
                        p_segment: rentSegment,
                        p_limit: 500,
                        p_neighborhood_ids: p.filterMode === "neighborhood" ? nhIdsForSearch : null,
                        p_neighborhood_id: null,
                        p_subject_zip: p.filterMode === "neighborhood" && !nhIdsForSearch ? subjectZip : null,
                        p_home_type: null,
                    })) as Omit<CompResult, "img_src" | "latitude" | "longitude">[];
                } catch (rpcError) {
                    if (gen !== searchGenRef.current) return;
                    setError("Failed to find comps: " + (rpcError instanceof Error ? rpcError.message : String(rpcError)));
                    if (gen === searchGenRef.current) setLoading(false);
                    return;
                }

                if (gen !== searchGenRef.current) return;

                const ids = compsData.map((r) => r.id);
                const { data: metaData } = await supabase.from("cleaned_listings").select("id, img_src, latitude, longitude").in("id", ids);

                if (gen !== searchGenRef.current) return;

                const metaMap = Object.fromEntries(
                    (metaData ?? []).map((r: any) => [
                        r.id,
                        {
                            img_src: r.img_src as string | null,
                            latitude: r.latitude as number | null,
                            longitude: r.longitude as number | null,
                        },
                    ]),
                );
                const subjectStreet = p.addr.split(",")[0].trim().toLowerCase();
                const merged: CompResult[] = compsData
                    .map((r) => {
                        const meta = metaMap[r.id] ?? {};
                        return {
                            ...r,
                            img_src: meta.img_src ?? null,
                            latitude: meta.latitude ?? null,
                            longitude: meta.longitude ?? null,
                        };
                    })
                    .filter((r) => (r.address_street || r.address_raw || "").split(",")[0].trim().toLowerCase() !== subjectStreet);
                setComps(merged);
                setCompsPage(1);
            } catch (err) {
                // Ignore errors from aborted (superseded) requests
                if (err instanceof Error && err.name === "AbortError") return;
                if (gen !== searchGenRef.current) return;
                setError("Something went wrong. Please try again.");
            }
            if (gen === searchGenRef.current) setLoading(false);
        },
        [rentSegment, cachedZip, refreshCandidates],
    );

    // Re-run search when any filter changes (if a search has already been initiated)
    useEffect(() => {
        if (!hasSearchedRef.current) return;
        if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = setTimeout(() => {
            findComps();
        }, 500);
        return () => {
            if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rentSegment, subjectPrice, subjectBeds, subjectBaths, subjectArea, radiusMiles, filterMode]);

    // Auto-run search on mount if URL has saved params
    useEffect(() => {
        if (didAutoSearch.current || !initAddress) return;
        didAutoSearch.current = true;
        runSearch({
            addr: initAddress,
            coords: initCoords,
            radius: initRadius,
            price: initPrice,
            beds: initBeds,
            baths: initBaths,
            area: initArea,
            segment: initSegment,
            filterMode: initFilterMode,
            zip: initZip,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const findComps = () => {
        if (autoRunTimerRef.current) {
            clearTimeout(autoRunTimerRef.current);
            autoRunTimerRef.current = null;
        }
        const p: SearchParams = {
            addr: address,
            coords: selectedCoords,
            radius: radiusMiles,
            price: subjectPrice,
            filterMode,
            beds: subjectBeds,
            baths: subjectBaths,
            area: subjectArea,
            segment: rentSegment,
            zip: cachedZip,
        };
        pushToUrl(p);
        runSearch(p);
    };

    // Assign toggle handler each render to avoid stale closures via ref
    toggleNhRef.current = (nhId: number, action: "add" | "remove") => {
        const cur = selectedNhIdsRef.current;
        if (action === "remove" && cur.length <= 1) return;
        const newIds = action === "add" ? [...cur, nhId] : cur.filter((id) => id !== nhId);
        setSelectedNhIds(newIds);
        selectedNhIdsRef.current = newIds;
        // Immediately remove from candidates (don't wait for async refresh)
        if (action === "add") setCandidateNhIds((prev) => prev.filter((id) => id !== nhId));
        refreshCandidates(newIds);
        const primary = nhDataCacheRef.current[newIds[0]];
        if (primary) {
            setNeighborhoodName(newIds.length > 1 ? `${primary.name} + ${newIds.length - 1} more` : `${primary.name}, ${primary.city}`);
        }
        // Auto-refresh comps when neighborhoods are toggled on the map
        if (autoRunTimerRef.current) clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = setTimeout(() => {
            findComps();
        }, 300);
    };

    const hasSubjectAttrs = subjectPrice || subjectBeds || subjectBaths || subjectArea;

    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        if (address.length < 3 || selectedCoords) {
            setSuggestions([]);
            return;
        }
        suggestTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&types=address,place&country=US${userLocation ? `&proximity=${userLocation[0]},${userLocation[1]}` : ""}`,
                );
                const data = await res.json();
                setSuggestions((data.features ?? []) as MapboxFeature[]);
                setShowSuggestions(true);
            } catch {
                setSuggestions([]);
            }
        }, 250);
    }, [address, selectedCoords, userLocation]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        if (!selectedCoords) {
            miniMapInstance.current?.remove();
            miniMapInstance.current = null;
            miniMapCompMarkersRef.current.forEach((m) => m.remove());
            miniMapCompMarkersRef.current = [];
            const previousRoots = [...miniMapPopupRootsRef.current];
            miniMapPopupRootsRef.current = [];
            setTimeout(() => {
                previousRoots.forEach((root) => {
                    try {
                        root.unmount();
                    } catch {
                        // ignore
                    }
                });
            }, 0);
            return;
        }
        if (!miniMapContainerRef.current || miniMapInstance.current) return;

        const map = new mapboxgl.Map({
            container: miniMapContainerRef.current,
            style: "mapbox://styles/mapbox/light-v11",
            center: selectedCoords,
            zoom: 11,
            accessToken: MAPBOX_TOKEN,
            interactive: true,
            attributionControl: false,
        });

        map.on("load", () => {
            new mapboxgl.Marker({ color: "#3b82f6" }).setLngLat(selectedCoords!).addTo(map);
            // Radius circle layers
            map.addSource("radius", { type: "geojson", data: makeCircle(selectedCoords!, radiusMiles * 1609.34) });
            map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#3b82f6", "fill-opacity": 0.12 } });
            map.addLayer({ id: "radius-outline", type: "line", source: "radius", paint: { "line-color": "#3b82f6", "line-width": 1.5, "line-opacity": 0.6 } });
            // Selected neighborhoods (purple)
            map.addSource("neighborhoods-selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            map.addLayer({
                id: "neighborhoods-selected-fill",
                type: "fill",
                source: "neighborhoods-selected",
                paint: { "fill-color": "#8b5cf6", "fill-opacity": 0.1 },
                layout: { visibility: "none" },
            });
            map.addLayer({
                id: "neighborhoods-selected-outline",
                type: "line",
                source: "neighborhoods-selected",
                paint: { "line-color": "#8b5cf6", "line-width": 2, "line-opacity": 0.8 },
                layout: { visibility: "none" },
            });
            map.addLayer({
                id: "neighborhoods-selected-labels",
                type: "symbol",
                source: "neighborhoods-selected",
                layout: {
                    "text-field": ["get", "name"],
                    "text-size": 11,
                    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
                    "text-anchor": "center",
                    "symbol-placement": "point",
                    visibility: "none",
                },
                paint: { "text-color": "#6d28d9", "text-halo-color": "#ffffff", "text-halo-width": 2 },
            });
            // Candidate neighborhoods (green)
            map.addSource("neighborhoods-candidate", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            map.addLayer({
                id: "neighborhoods-candidate-fill",
                type: "fill",
                source: "neighborhoods-candidate",
                paint: { "fill-color": "#16a34a", "fill-opacity": 0.12 },
                layout: { visibility: "none" },
            });
            map.addLayer({
                id: "neighborhoods-candidate-outline",
                type: "line",
                source: "neighborhoods-candidate",
                paint: { "line-color": "#15803d", "line-width": 1.5 },
                layout: { visibility: "none" },
            });
            map.addLayer({
                id: "neighborhoods-candidate-labels",
                type: "symbol",
                source: "neighborhoods-candidate",
                layout: {
                    "text-field": ["concat", "＋ ", ["get", "name"]],
                    "text-size": 10,
                    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
                    "text-anchor": "center",
                    "symbol-placement": "point",
                    visibility: "none",
                },
                paint: { "text-color": "#15803d", "text-halo-color": "#ffffff", "text-halo-width": 2 },
            });
            // ZIP boundary (amber dashed)
            map.addSource("zip-boundary", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            map.addLayer({
                id: "zip-boundary-fill",
                type: "fill",
                source: "zip-boundary",
                paint: { "fill-color": "#f59e0b", "fill-opacity": 0.08 },
                layout: { visibility: "none" },
            });
            map.addLayer({
                id: "zip-boundary-outline",
                type: "line",
                source: "zip-boundary",
                paint: { "line-color": "#d97706", "line-width": 2, "line-dasharray": [5, 3] },
                layout: { visibility: "none" },
            });
            // Click: candidate → add to selected; selected → remove from selected
            map.on("click", "neighborhoods-candidate-fill", (e) => {
                const id = e.features?.[0]?.properties?.id as number | undefined;
                if (id != null) toggleNhRef.current?.(id, "add");
            });
            map.on("click", "neighborhoods-selected-fill", (e) => {
                const id = e.features?.[0]?.properties?.id as number | undefined;
                if (id != null) toggleNhRef.current?.(id, "remove");
            });
            ["neighborhoods-candidate-fill", "neighborhoods-selected-fill"].forEach((layer) => {
                map.on("mouseenter", layer, () => {
                    map.getCanvas().style.cursor = "pointer";
                });
                map.on("mouseleave", layer, () => {
                    map.getCanvas().style.cursor = "";
                });
            });
            const r = (radiusMiles * 1609.34) / 111320;
            const lng = selectedCoords![0],
                lat = selectedCoords![1];
            map.fitBounds(
                [
                    [lng - r / Math.cos((lat * Math.PI) / 180), lat - r],
                    [lng + r / Math.cos((lat * Math.PI) / 180), lat + r],
                ],
                { padding: 24, duration: 0 },
            );
        });

        miniMapInstance.current = map;
        return () => {
            miniMapCompMarkersRef.current.forEach((m) => m.remove());
            miniMapCompMarkersRef.current = [];
            const previousRoots = [...miniMapPopupRootsRef.current];
            miniMapPopupRootsRef.current = [];
            setTimeout(() => {
                previousRoots.forEach((root) => {
                    try {
                        root.unmount();
                    } catch {
                        // ignore
                    }
                });
            }, 0);
            miniMapInstance.current?.remove();
            miniMapInstance.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCoords]);

    useEffect(() => {
        const map = miniMapInstance.current;
        if (!map || !selectedCoords) return;
        const nhLayers = [
            "neighborhoods-selected-fill",
            "neighborhoods-selected-outline",
            "neighborhoods-selected-labels",
            "neighborhoods-candidate-fill",
            "neighborhoods-candidate-outline",
            "neighborhoods-candidate-labels",
        ];
        const vis = (ids: string[], v: "visible" | "none") =>
            ids.forEach((l) => {
                if (map.getLayer(l)) map.setLayoutProperty(l, "visibility", v);
            });
        const update = () => {
            const showNh = filterMode === "neighborhood";
            if (showNh && (selectedNhFC.features.length > 0 || candidateNhFC.features.length > 0)) {
                (map.getSource("neighborhoods-selected") as mapboxgl.GeoJSONSource | undefined)?.setData(selectedNhFC);
                (map.getSource("neighborhoods-candidate") as mapboxgl.GeoJSONSource | undefined)?.setData(candidateNhFC);
                vis(
                    ["neighborhoods-selected-fill", "neighborhoods-selected-outline", "neighborhoods-selected-labels"],
                    selectedNhFC.features.length > 0 ? "visible" : "none",
                );
                vis(
                    ["neighborhoods-candidate-fill", "neighborhoods-candidate-outline", "neighborhoods-candidate-labels"],
                    candidateNhFC.features.length > 0 ? "visible" : "none",
                );
                vis(["radius-fill", "radius-outline", "zip-boundary-fill", "zip-boundary-outline"], "none");
                if (!nhFittedRef.current && selectedNhFC.features.length > 0) {
                    const allFC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [...selectedNhFC.features, ...candidateNhFC.features] };
                    map.fitBounds(getGeomBounds(allFC), { padding: 40 });
                    // Lock only once candidates are included — the effect will run again
                    // when candidates load, giving us a final fit that includes both
                    if (candidateNhFC.features.length > 0) nhFittedRef.current = true;
                }
            } else if (showNh) {
                // ZIP fallback — show zip boundary if available
                vis(nhLayers, "none");
                vis(["radius-fill", "radius-outline"], "none");
                if (zipGeoJSON) {
                    (map.getSource("zip-boundary") as mapboxgl.GeoJSONSource | undefined)?.setData(zipGeoJSON);
                    vis(["zip-boundary-fill", "zip-boundary-outline"], "visible");
                    map.fitBounds(getGeomBounds(zipGeoJSON), { padding: 40 });
                } else {
                    vis(["zip-boundary-fill", "zip-boundary-outline"], "none");
                }
            } else {
                // Radius mode
                (map.getSource("radius") as mapboxgl.GeoJSONSource | undefined)?.setData(makeCircle(selectedCoords, radiusMiles * 1609.34));
                vis(["radius-fill", "radius-outline"], "visible");
                vis([...nhLayers, "zip-boundary-fill", "zip-boundary-outline"], "none");
                nhFittedRef.current = false;
                const r = (radiusMiles * 1609.34) / 111320;
                const [lng, lat] = selectedCoords;
                map.fitBounds(
                    [
                        [lng - r / Math.cos((lat * Math.PI) / 180), lat - r],
                        [lng + r / Math.cos((lat * Math.PI) / 180), lat + r],
                    ],
                    { padding: 24 },
                );
            }
        };
        map.isStyleLoaded() ? update() : map.once("load", update);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedNhFC, candidateNhFC, zipGeoJSON, filterMode, radiusMiles, selectedCoords]);

    // Plot comps on the radius preview map
    useEffect(() => {
        const map = miniMapInstance.current;
        if (!map) return;

        // Clear previous comp markers
        miniMapCompMarkersRef.current.forEach((m) => m.remove());
        miniMapCompMarkersRef.current = [];
        const previousRoots = [...miniMapPopupRootsRef.current];
        miniMapPopupRootsRef.current = [];
        setTimeout(() => {
            previousRoots.forEach((root) => {
                try {
                    root.unmount();
                } catch {
                    // ignore
                }
            });
        }, 0);

        if (!comps || comps.length === 0) return;

        const markers: mapboxgl.Marker[] = [];
        const compsWithCoords = comps.filter((c) => c.latitude != null && c.longitude != null);
        compsWithCoords.forEach((comp, idx) => {
            const lng = comp.longitude as number;
            const lat = comp.latitude as number;

            const addr =
                comp.address_raw ||
                [comp.address_street, comp.address_city, comp.address_state, comp.address_zip].filter(Boolean).join(", ") ||
                "Address not listed";

            const price = comp.price ? `$${comp.price.toLocaleString()}/mo` : "TBD";
            const beds = comp.beds ?? 0;
            const baths = comp.baths != null ? Number(comp.baths).toFixed(1) : null;
            const sqft = comp.area != null ? `${comp.area.toLocaleString()} sqft` : null;

            const popupContainer = document.createElement("div");
            const root = createRoot(popupContainer);
            miniMapPopupRootsRef.current.push(root);
            root.render(
                <PropertyPopupContent
                    name={addr}
                    address={addr}
                    price={price}
                    units={null}
                    capRate={`${beds} bd · ${baths ?? "?"} ba`}
                    squareFootage={sqft}
                    thumbnailUrl={comp.img_src}
                />,
            );

            const popup = new mapboxgl.Popup({
                offset: 16,
                closeButton: false,
                className: "property-popup",
            }).setDOMContent(popupContainer);

            const marker = new mapboxgl.Marker({ color: "#f97316" }).setLngLat([lng, lat]).setPopup(popup).addTo(map);

            marker.getElement().addEventListener("click", () => {
                map.flyTo({
                    center: [lng, lat],
                    zoom: Math.max(map.getZoom(), 12),
                    offset: [0, -120],
                    essential: true,
                });

                miniMapCompMarkersRef.current.forEach((m, idx) => {
                    const p = m.getPopup();
                    if (!p) return;
                    if (m === marker) {
                        if (!p.isOpen()) {
                            m.togglePopup();
                        }
                        setMiniMapActiveIndex(idx);
                    } else if (p.isOpen()) {
                        p.remove();
                    }
                });
            });

            markers.push(marker);
        });

        miniMapCompMarkersRef.current = markers;

        if (markers.length > 0) {
            setMiniMapActiveIndex((prev) => {
                if (prev == null || prev >= markers.length) return 0;
                return prev;
            });
        } else {
            setMiniMapActiveIndex(null);
        }
    }, [comps]);

    const selectSuggestion = (feature: MapboxFeature) => {
        setAddress(feature.place_name);
        setSelectedCoords(feature.center);
        setSubjectLabel(feature.place_name);
        const zip = feature.context?.find((c) => c.id.startsWith("postcode."))?.text ?? null;
        if (zip) setCachedZip(zip);
        setSuggestions([]);
        setShowSuggestions(false);

        // Auto-trigger search immediately with the selected address coords
        runSearch({
            addr: feature.place_name,
            coords: feature.center,
            radius: radiusMiles,
            price: subjectPrice,
            filterMode,
            beds: subjectBeds,
            baths: subjectBaths,
            area: subjectArea,
            segment: rentSegment,
            zip: zip ?? cachedZip,
        });

        // Auto-detect neighborhood in background so it's ready before search
        const [lng, lat] = feature.center;
        findNeighborhood({ p_lng: lng, p_lat: lat })
            .then((nhData) => {
                if (nhData.length > 0) {
                    const nhId = nhData[0].id;
                    lastNhDetectedRef.current = { lng, lat };
                    nhFittedRef.current = false;
                    const newCache: Record<number, NhData> = {
                        [nhId]: { id: nhId, name: nhData[0].name, city: nhData[0].city, geojson: nhData[0].geojson },
                    };
                    setNhDataCache(newCache);
                    nhDataCacheRef.current = newCache;
                    setSelectedNhIds([nhId]);
                    selectedNhIdsRef.current = [nhId];
                    setCandidateNhIds([]);
                    setZipGeoJSON(null);
                    setNeighborhoodName(`${nhData[0].name}, ${nhData[0].city}`);
                    refreshCandidates([nhId]);
                } else {
                    // No neighborhood found — clear state, show ZIP if available
                    setSelectedNhIds([]);
                    setCandidateNhIds([]);
                    setNhDataCache({});
                    selectedNhIdsRef.current = [];
                    lastNhDetectedRef.current = null;
                    setNeighborhoodName(zip ? `ZIP ${zip}` : null);
                }
            })
            .catch(() => {});
    };

    // Rent estimate banner removed

    const handleSort = (col: CompSortColumn) => {
        if (sortCol === col) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortCol(col);
            setSortDir("asc");
        }
        setCompsPage(1);
    };

    const sortedComps = useMemo(
        () =>
            sortCompResults(comps ?? [], sortCol, sortDir, {
                price: subjectPrice,
                beds: subjectBeds,
                baths: subjectBaths,
                area: subjectArea,
            }),
        [comps, sortCol, sortDir, subjectPrice, subjectBeds, subjectBaths, subjectArea],
    );

    const marketStats = useMemo(() => buildMarketStats(sortedComps, subjectPrice), [sortedComps, subjectPrice]);

    return (
        <div className="flex-1 overflow-auto p-6">
            <div className="mx-auto max-w-6xl space-y-4">
                {/* Search form */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Find Comparable Rentals</h3>
                    <div className="space-y-4">
                        {/* Address */}
                        <div>
                            <Label className="mb-1.5 block text-xs">Subject Property Address</Label>
                            <div className="relative" ref={inputWrapperRef}>
                                <MapPin className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder="e.g. 1228 El Camino Real, Palo Alto, CA"
                                    value={address}
                                    onChange={(e) => {
                                        setAddress(e.target.value);
                                        setSelectedCoords(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            setShowSuggestions(false);
                                            findComps();
                                        }
                                        if (e.key === "Escape") setShowSuggestions(false);
                                    }}
                                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                    className="pl-9"
                                    autoComplete="off"
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <ul className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                                        {suggestions.map((feature) => (
                                            <li key={feature.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectSuggestion(feature);
                                                    }}
                                                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                                                >
                                                    <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-gray-400" />
                                                    <span className="leading-snug text-gray-800 dark:text-gray-200">{feature.place_name}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Filter mode toggle + radius/neighborhood control */}
                        <div>
                            <div className="mb-3 flex items-center gap-2">
                                <Label className="text-xs">Search by</Label>
                                <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-700">
                                    {(["radius", "neighborhood"] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => {
                                                setFilterMode(mode);
                                                if (mode === "radius") {
                                                    setNeighborhoodName(null);
                                                    setSelectedNhIds([]);
                                                    setCandidateNhIds([]);
                                                    setNhDataCache({});
                                                    selectedNhIdsRef.current = [];
                                                    lastNhDetectedRef.current = null;
                                                }
                                            }}
                                            className={cn(
                                                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                                                filterMode === mode
                                                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400",
                                            )}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filterMode === "radius" ? (
                                <>
                                    <div className="mb-1.5 flex justify-between">
                                        <Label className="text-xs">Search Radius</Label>
                                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{radiusMiles} mi</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="10"
                                        step="0.5"
                                        value={radiusMiles}
                                        onChange={(e) => setRadiusMiles(parseFloat(e.target.value))}
                                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600 dark:bg-gray-700"
                                    />
                                    <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                                        <span>0.5 mi</span>
                                        <span>10 mi</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {neighborhoodName ? (
                                            <span>
                                                Searching in <span className="font-semibold text-violet-700 dark:text-violet-300">{neighborhoodName}</span>
                                            </span>
                                        ) : selectedCoords ? (
                                            <span className="text-gray-400">Neighborhood will be detected when you search</span>
                                        ) : null}
                                    </div>
                                    {selectedNhIds.length > 0 && <p className="mt-1 text-[10px] text-gray-400">Click map to add or remove neighborhoods</p>}
                                </>
                            )}
                        </div>

                        {/* Radius preview map */}
                        <div
                            ref={miniMapContainerRef}
                            className={cn("overflow-hidden rounded-lg transition-all duration-300", selectedCoords ? "h-80" : "h-0")}
                        />
                        {(loading || (comps && comps.length > 0)) && selectedCoords && (
                            <div className="mt-2 flex justify-center gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={loading}
                                    onClick={() => {
                                        const total = miniMapCompMarkersRef.current.length;
                                        if (!total) return;
                                        const current = miniMapActiveIndex ?? 0;
                                        const next = (current - 1 + total) % total;
                                        setMiniMapActiveIndex(next);
                                        const map = miniMapInstance.current;
                                        const marker = miniMapCompMarkersRef.current[next];
                                        if (!map || !marker) return;
                                        const lngLat = marker.getLngLat();
                                        map.flyTo({
                                            center: [lngLat.lng, lngLat.lat],
                                            zoom: Math.max(map.getZoom(), 12),
                                            offset: [0, -120],
                                            essential: true,
                                        });
                                        miniMapCompMarkersRef.current.forEach((m, idx) => {
                                            const p = m.getPopup();
                                            if (!p) return;
                                            if (idx === next) {
                                                if (!p.isOpen()) {
                                                    m.togglePopup();
                                                }
                                            } else if (p.isOpen()) {
                                                p.remove();
                                            }
                                        });
                                    }}
                                >
                                    Prev
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={loading}
                                    onClick={() => {
                                        const total = miniMapCompMarkersRef.current.length;
                                        if (!total) return;
                                        const current = miniMapActiveIndex ?? -1;
                                        const next = (current + 1 + total) % total;
                                        setMiniMapActiveIndex(next);
                                        const map = miniMapInstance.current;
                                        const marker = miniMapCompMarkersRef.current[next];
                                        if (!map || !marker) return;
                                        const lngLat = marker.getLngLat();
                                        map.flyTo({
                                            center: [lngLat.lng, lngLat.lat],
                                            zoom: Math.max(map.getZoom(), 12),
                                            offset: [0, -120],
                                            essential: true,
                                        });
                                        miniMapCompMarkersRef.current.forEach((m, idx) => {
                                            const p = m.getPopup();
                                            if (!p) return;
                                            if (idx === next) {
                                                if (!p.isOpen()) {
                                                    m.togglePopup();
                                                }
                                            } else if (p.isOpen()) {
                                                p.remove();
                                            }
                                        });
                                    }}
                                >
                                    Next
                                </Button>
                            </div>
                        )}

                        {/* Subject attributes */}
                        <div>
                            <p className="mb-2 text-xs text-gray-500">Tip: the more info you provide, the better your comps.</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                <div>
                                    <Label className="mb-1 block text-xs">Rent / mo</Label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 3500"
                                        value={subjectPrice}
                                        onChange={(e) => setSubjectPrice(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="mb-1 block text-xs">
                                        Beds <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 3"
                                        value={subjectBeds}
                                        onChange={(e) => setSubjectBeds(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="mb-1 block text-xs">
                                        Baths <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="e.g. 2"
                                        value={subjectBaths}
                                        onChange={(e) => setSubjectBaths(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="mb-1 block text-xs">Sq Ft</Label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 1200"
                                        value={subjectArea}
                                        onChange={(e) => setSubjectArea(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="mb-1 block text-xs">Segment</Label>
                                    <select
                                        value={rentSegment}
                                        onChange={(e) => setRentSegment(e.target.value as "mid" | "reit" | "both")}
                                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                    >
                                        <option value="both">All</option>
                                        <option value="mid">Mid-market</option>
                                        <option value="reit">REIT</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={findComps}
                            disabled={loading || !address.trim() || !subjectBeds.trim() || !subjectBaths.trim()}
                            className="mt-2 w-full"
                        >
                            {loading ? "Searching..." : "Find Comps"}
                        </Button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
                        <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Searching for comps...</p>
                    </div>
                )}

                {/* Rent estimate banner removed */}

                {/* Market distribution summary */}
                {!loading && marketStats && (
                    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Market Rent Distribution</h3>
                            <span className="text-xs text-gray-400">
                                {marketStats.n} listing{marketStats.n !== 1 ? "s" : ""}
                            </span>
                        </div>

                        {/* Small-n warning */}
                        {marketStats.n < 8 && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                Only {marketStats.n} comp{marketStats.n !== 1 ? "s" : ""} found — treat this range as approximate.
                            </div>
                        )}

                        {/* Stat row — gated by n */}
                        {marketStats.n < 3 ? (
                            <div className="grid grid-cols-2 gap-2 text-center">
                                {[
                                    { label: "Min", value: marketStats.min },
                                    { label: "Max", value: marketStats.max },
                                ].map(({ label, value }) => (
                                    <div key={label} className="rounded-lg bg-gray-50 px-1 py-2 dark:bg-gray-700/40">
                                        <p className="mb-0.5 text-[10px] tracking-wide text-gray-400 uppercase dark:text-gray-500">{label}</p>
                                        <p className="text-sm font-semibold text-gray-800 tabular-nums dark:text-gray-200">
                                            ${Math.round(value).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : marketStats.n < 8 ? (
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {[
                                    { label: "Min", value: marketStats.min },
                                    { label: "Median", value: marketStats.median, highlight: true },
                                    { label: "Max", value: marketStats.max },
                                ].map(({ label, value, highlight }) => (
                                    <div
                                        key={label}
                                        className={cn("rounded-lg px-1 py-2", highlight ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-700/40")}
                                    >
                                        <p className="mb-0.5 text-[10px] tracking-wide text-gray-400 uppercase dark:text-gray-500">{label}</p>
                                        <p
                                            className={cn(
                                                "text-sm font-semibold tabular-nums",
                                                highlight ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200",
                                            )}
                                        >
                                            ${Math.round(value).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-5 gap-2 text-center">
                                {[
                                    { label: "Min", value: marketStats.min },
                                    { label: "25th %ile", value: marketStats.p25 },
                                    { label: "Median", value: marketStats.median, highlight: true },
                                    { label: "75th %ile", value: marketStats.p75 },
                                    { label: "Max", value: marketStats.max },
                                ].map(({ label, value, highlight }) => (
                                    <div
                                        key={label}
                                        className={cn("rounded-lg px-1 py-2", highlight ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-700/40")}
                                    >
                                        <p className="mb-0.5 text-[10px] tracking-wide text-gray-400 uppercase dark:text-gray-500">{label}</p>
                                        <p
                                            className={cn(
                                                "text-sm font-semibold tabular-nums",
                                                highlight ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200",
                                            )}
                                        >
                                            ${Math.round(value).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Range bar — only when n >= 3 */}
                        {marketStats.n >= 3 &&
                            (() => {
                                const range = marketStats.max - marketStats.min || 1;
                                const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - marketStats.min) / range) * 100))}%`;
                                const subjectPx = subjectPrice ? parseInt(subjectPrice) : null;
                                return (
                                    <div className="relative flex h-6 items-center">
                                        <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
                                        {marketStats.n >= 8 && (
                                            <div
                                                className="absolute h-1.5 rounded-full bg-blue-300 dark:bg-blue-600"
                                                style={{ left: pos(marketStats.p25), right: `${100 - parseFloat(pos(marketStats.p75))}%` }}
                                            />
                                        )}
                                        <div
                                            className="absolute h-4 w-0.5 -translate-x-1/2 rounded-full bg-blue-600 dark:bg-blue-400"
                                            style={{ left: pos(marketStats.median) }}
                                        />
                                        {subjectPx != null && (
                                            <div
                                                className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-orange-500 shadow dark:border-gray-800"
                                                style={{ left: pos(subjectPx) }}
                                                title={`Subject rent: $${subjectPx.toLocaleString()}`}
                                            />
                                        )}
                                    </div>
                                );
                            })()}

                        {/* Legend — only when n >= 8 */}
                        {marketStats.n >= 8 && (
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block h-1.5 w-3 rounded-full bg-blue-300 dark:bg-blue-600" />
                                    Middle 50%
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block h-3 w-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                                    Median
                                </span>
                                {subjectPrice && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500 dark:border-gray-800" />
                                        Subject rent
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Percentile callout — only when n >= 8 */}
                        {marketStats.n >= 8 && marketStats.subjectPercentile !== null && (
                            <div
                                className={cn(
                                    "rounded-lg px-4 py-3 text-sm font-medium",
                                    marketStats.subjectPercentile >= 50
                                        ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                                        : "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200",
                                )}
                            >
                                Subject rent of <span className="font-bold">${parseInt(subjectPrice).toLocaleString()}/mo</span> is higher than{" "}
                                <span className="font-bold">{marketStats.subjectPercentile}%</span> of similar listings
                            </div>
                        )}
                    </div>
                )}

                {/* Results table */}
                {!loading && comps !== null && (
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                    {sortedComps.length} comp{sortedComps.length !== 1 ? "s" : ""} found
                                </h3>
                                {subjectLabel && <p className="mt-0.5 max-w-md truncate text-xs text-gray-500">{subjectLabel}</p>}
                            </div>
                            <span className="mt-1 text-xs text-gray-400">Ranked by {hasSubjectAttrs ? "composite score" : "distance"}</span>
                        </div>

                        {comps.length === 0 ? (
                            <div className="p-8 text-center text-sm text-gray-500">
                                {filterMode === "neighborhood" && neighborhoodName
                                    ? `No comps found in ${neighborhoodName}. Try switching to radius search or adjusting filters.`
                                    : `No comps found within ${radiusMiles} miles. Try a different address or expand the radius.`}
                            </div>
                        ) : (
                            <div className="overflow-x-auto" key={compsPage}>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/30">
                                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-gray-500 uppercase">#</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-gray-500 uppercase">Address</th>
                                            {(["price", "beds", "baths", "area", "ppsf", "distance", "score"] as const).map((col, idx) => {
                                                const labels: Record<string, string> = {
                                                    price: "Rent/mo",
                                                    beds: "Beds",
                                                    baths: "Baths",
                                                    area: "Sq Ft",
                                                    ppsf: "$/Sq Ft",
                                                    distance: "Distance",
                                                    score: "Score",
                                                };
                                                const active = sortCol === col;
                                                return (
                                                    <th
                                                        key={col}
                                                        onClick={() => handleSort(col)}
                                                        className={cn(
                                                            "cursor-pointer px-4 py-3 text-xs font-semibold tracking-wider whitespace-nowrap uppercase transition-colors select-none",
                                                            idx < 4 ? "text-right" : "text-right",
                                                            active
                                                                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                                                        )}
                                                    >
                                                        <span className="inline-flex items-center justify-end gap-1">
                                                            {labels[col]}
                                                            <span className="text-[10px]">{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
                                                        </span>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Subject property row */}
                                        <tr className="border-b-2 border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20">
                                            <td className="px-4 py-3 text-xs font-semibold text-blue-600 dark:text-blue-400">Subject</td>
                                            <td className="px-4 py-3">
                                                <div className="max-w-[200px] truncate font-medium text-blue-900 dark:text-blue-100">
                                                    {titleCaseAddress(subjectLabel?.split(",")[0]) || address || "—"}
                                                </div>
                                                <div className="max-w-[200px] truncate text-xs text-blue-600/70 dark:text-blue-400/70">
                                                    {subjectLabel?.split(",").slice(1).join(",").trim() || ""}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-blue-900 dark:text-blue-100">
                                                {subjectPrice ? `$${parseInt(subjectPrice).toLocaleString()}` : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-800 dark:text-blue-200">{subjectBeds || "—"}</td>
                                            <td className="px-4 py-3 text-right text-blue-800 dark:text-blue-200">
                                                {subjectBaths ? Number(subjectBaths).toFixed(1) : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-800 dark:text-blue-200">
                                                {subjectArea ? parseInt(subjectArea).toLocaleString() : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-800 dark:text-blue-200">
                                                {subjectPrice && subjectArea ? `$${(parseInt(subjectPrice) / parseInt(subjectArea)).toFixed(2)}` : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-blue-600/70 dark:text-blue-400/70">0 mi</td>
                                            <td className="px-4 py-3 text-right text-xs text-blue-600/70 dark:text-blue-400/70">—</td>
                                        </tr>
                                        {sortedComps.slice((compsPage - 1) * 25, compsPage * 25).map((comp, i) => {
                                            const isAggregated = comp.unit_count > 1;
                                            const subLabel = isAggregated
                                                ? `${comp.beds ?? 0} bed · ${comp.baths != null ? Number(comp.baths).toFixed(1) : "?"} ba · ${comp.unit_count} units`
                                                : [titleCaseAddress(comp.address_city), comp.address_state?.toUpperCase(), comp.address_zip]
                                                      .filter(Boolean)
                                                      .join(", ");
                                            return (
                                                <tr
                                                    key={isAggregated ? `agg-${comp.building_zpid}-${comp.beds ?? 0}-${comp.baths}` : comp.id}
                                                    className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30"
                                                >
                                                    <td className="px-4 py-3 text-xs text-gray-400">{(compsPage - 1) * 25 + i + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedCompId(`zillow-${comp.id}`)}
                                                            className="group flex w-full cursor-pointer items-center gap-3 text-left"
                                                        >
                                                            <div className="h-12 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
                                                                {comp.img_src ? (
                                                                    <img src={comp.img_src} alt="" className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="flex h-full w-full items-center justify-center">
                                                                        <Building2 className="size-4 text-gray-400" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="flex max-w-[160px] items-center gap-1.5 truncate font-medium text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                                                                    {titleCaseAddress(comp.address_street || comp.address_raw) || "—"}
                                                                    {comp.building_zpid && (
                                                                        <span className="flex-shrink-0 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                                                                            REIT
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="max-w-[160px] truncate text-xs text-gray-500">{subLabel}</div>
                                                            </div>
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                                                        {comp.price ? `$${comp.price.toLocaleString()}${isAggregated ? " avg" : ""}` : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{comp.beds ?? 0}</td>
                                                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                        {comp.baths ? Number(comp.baths).toFixed(1) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                        {comp.area?.toLocaleString() ?? "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                        {comp.price && comp.area ? `$${(comp.price / comp.area).toFixed(2)}` : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-xs text-gray-500">{metersToMiles(comp.distance_m)} mi</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={cn("text-sm font-semibold tabular-nums", scoreColor(comp.composite_score))}>
                                                            {Math.round(comp.composite_score * 100)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {sortedComps.length > 25 && (
                            <PaginationButtonGroup page={compsPage} total={Math.ceil(sortedComps.length / 25)} onPageChange={setCompsPage} align="center" />
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!loading && comps === null && (
                    <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
                        <Search className="mx-auto mb-3 size-10 text-gray-300 dark:text-gray-600" />
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Enter an address to find comparable rentals</p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Searches within 2 miles using the latest scraped data</p>
                    </div>
                )}
            </div>

            <Dialog
                open={!!selectedCompId}
                onOpenChange={(open) => {
                    if (!open) setSelectedCompId(null);
                }}
            >
                <DialogContent className="flex h-[90vh] w-full !max-w-[65vw] flex-col overflow-hidden p-0 pr-14">
                    <VisuallyHidden>
                        <DialogTitle>Property Detail</DialogTitle>
                    </VisuallyHidden>
                    {selectedCompId && <ListingDetailContent key={selectedCompId} id={selectedCompId} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function CompsPage() {
    return (
        <Suspense>
            <CompsContent />
        </Suspense>
    );
}
