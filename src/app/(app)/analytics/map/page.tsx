"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, LayoutList, Map as MapIcon, MapPin, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PropertiesSidebar } from "@/app/(app)/analytics/map/properties-sidebar";
import { type MapBounds, type Property, PropertyMap } from "@/components/application/map/property-map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    getCityGeojson,
    getCountyGeojson,
    getMsaBbox,
    getMsaGeojson,
    getNeighborhoodBbox,
    getNeighborhoodGeojson,
    getZipBoundary,
    searchMsas,
    searchNeighborhoods,
} from "@/db/rpc";
import {
    AREA_TYPE_LABELS,
    AREA_TYPE_PLACEHOLDERS,
    type AreaFilter,
    type AreaType,
    BATH_OPTIONS,
    BED_OPTIONS,
    type Filters,
    LAUNDRY_OPTIONS,
    type MapListingSource,
    buildMapSearchParams,
    countActiveMapFilters,
    createDefaultMapFilters,
    parseAreaFilter,
    parseAreaType,
    parseListingsViewMode,
    parseMapFilters,
    parseMapListingSource,
    parseShowLatestOnly,
} from "@/lib/analytics/map-page";
import { type ZillowMapListingRow, mapLoopnetRow, mapZillowRpcRow } from "@/lib/map-listings";
import { cn } from "@/lib/utils";
import { boundsContainedIn, expandBounds, getUncoveredBounds, snapBounds } from "@/lib/viewport-bounds";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

async function fetchZillowListings(params: {
    zip: string | null;
    city: string | null;
    addressQuery: string | null;
    latestOnly: boolean;
    priceMin: number | null;
    priceMax: number | null;
    sqftMin: number | null;
    sqftMax: number | null;
    beds: number[] | null;
    bathsMin: number | null;
    laundry: ("in_unit" | "shared" | "none")[] | null;
    propertyType: "both" | "reit" | "mid";
    bounds: MapBounds | null;
}): Promise<ZillowMapListingRow[]> {
    const sp = new URLSearchParams();
    if (params.zip) sp.set("zip", params.zip);
    if (params.city) sp.set("city", params.city);
    if (params.addressQuery) sp.set("address_query", params.addressQuery);
    sp.set("latest_only", String(params.latestOnly));
    if (params.priceMin !== null) sp.set("price_min", String(params.priceMin));
    if (params.priceMax !== null) sp.set("price_max", String(params.priceMax));
    if (params.sqftMin !== null) sp.set("sqft_min", String(params.sqftMin));
    if (params.sqftMax !== null) sp.set("sqft_max", String(params.sqftMax));
    if (params.beds !== null && params.beds.length > 0) sp.set("beds", params.beds.join(","));
    if (params.bathsMin !== null) sp.set("baths_min", String(params.bathsMin));
    if (params.laundry !== null && params.laundry.length > 0) sp.set("laundry", params.laundry.join(","));
    sp.set("property_type", params.propertyType);
    if (params.bounds) {
        const snappedBounds = snapBounds(params.bounds);
        sp.set("bounds_south", String(snappedBounds.south));
        sp.set("bounds_north", String(snappedBounds.north));
        sp.set("bounds_west", String(snappedBounds.west));
        sp.set("bounds_east", String(snappedBounds.east));
    }

    const response = await fetch(`/api/listings/zillow?${sp.toString()}`);
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    return response.json();
}

function filterToViewport(rows: ZillowMapListingRow[], bounds: MapBounds | null): ZillowMapListingRow[] {
    if (!bounds) return rows;
    return rows.filter((r) => r.latitude >= bounds.south && r.latitude <= bounds.north && r.longitude >= bounds.west && r.longitude <= bounds.east);
}

function buildZillowFilterKey(areaFilter: AreaFilter | null, filters: Filters, showLatestOnly: boolean): string {
    return JSON.stringify({
        z: areaFilter?.zipCode ?? null,
        c: areaFilter?.cityName ?? null,
        a: areaFilter?.addressQuery ?? null,
        l: showLatestOnly,
        pm: filters.priceMin,
        px: filters.priceMax,
        sm: filters.sqftMin,
        sx: filters.sqftMax,
        b: filters.beds,
        ba: filters.bathsMin,
        lnd: filters.laundry,
        t: filters.propertyType,
    });
}

type AreaSuggestion =
    | { kind: "neighborhood"; id: number; name: string; city: string; state: string }
    | { kind: "mapbox"; feature: MapboxFeature }
    | { kind: "msa"; id: number; geoid: string; name: string; name_lsad: string }
    | { kind: "zip"; feature: MapboxFeature }
    | { kind: "address"; feature: MapboxFeature };

interface MapboxFeature {
    id: string;
    text: string;
    place_name: string;
    center: [number, number];
    bbox?: [number, number, number, number];
    context?: Array<{ id: string; text: string; short_code?: string }>;
}

function MapPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialCenter = useMemo<[number, number] | undefined>(() => {
        const lat = parseFloat(searchParams.get("lat") ?? "");
        const lng = parseFloat(searchParams.get("lng") ?? "");
        return isNaN(lat) || isNaN(lng) ? undefined : [lng, lat];
    }, []);
    const initialZoom = useMemo<number | undefined>(() => {
        const z = parseFloat(searchParams.get("zoom") ?? "");
        return isNaN(z) ? undefined : z;
    }, []);

    const [allZillowRows, setAllZillowRows] = useState<ZillowMapListingRow[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [filters, setFilters] = useState<Filters>(() => parseMapFilters(searchParams));
    const [mapListingSource, setMapListingSource] = useState<MapListingSource>(() => parseMapListingSource(searchParams));
    const [showLatestOnly, setShowLatestOnly] = useState<boolean>(() => parseShowLatestOnly(searchParams));
    const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
    const mapBoundsRef = useRef<MapBounds | null>(null);
    const [listingsViewMode, setListingsViewMode] = useState<"map" | "list">(() => parseListingsViewMode(searchParams));
    const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Area-type search state
    const [areaType, setAreaType] = useState<AreaType>(() => parseAreaType(searchParams));
    const [areaFilter, setAreaFilter] = useState<AreaFilter | null>(() => parseAreaFilter(searchParams));
    const [areaInput, setAreaInput] = useState<string>(() => {
        return searchParams.get("area") ?? "";
    });
    const [areaSuggestions, setAreaSuggestions] = useState<AreaSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [fitBoundsTarget, setFitBoundsTarget] = useState<MapBounds | null>(null);
    const [boundaryGeoJSON, setBoundaryGeoJSON] = useState<string | null>(null);
    const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suggestAbortControllerRef = useRef<AbortController | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);

    // Client-side cache: avoid re-fetching Zillow rows when zooming into an
    // already-fetched area. We track a map of filter-key → { rows, union bbox }
    // so we only hit the network when the viewport extends beyond what we've
    // already retrieved for the current set of non-spatial filters.
    const zillowCacheRef = useRef<
        Map<
            string,
            {
                rows: ZillowMapListingRow[];
                coveredBounds: { south: number; north: number; west: number; east: number };
            }
        >
    >(new Map());

    const activeFilterCount = useMemo(() => countActiveMapFilters(filters, mapListingSource), [filters, mapListingSource]);

    const clearFilters = () => {
        setFilters(createDefaultMapFilters());
    };

    const clearAreaFilter = () => {
        setAreaFilter(null);
        setAreaInput("");
        setAreaSuggestions([]);
        setBoundaryGeoJSON(null);
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };

    // Autocomplete suggestions based on area type
    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        suggestAbortControllerRef.current?.abort();

        if (areaFilter || areaInput.length < 2) {
            setAreaSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        let cancelled = false;

        suggestTimerRef.current = setTimeout(async () => {
            suggestAbortControllerRef.current?.abort();
            const controller = new AbortController();
            suggestAbortControllerRef.current = controller;
            if (areaType === "zip") {
                try {
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(areaInput)}.json?access_token=${MAPBOX_TOKEN}&types=postcode&country=US&limit=6`,
                        { signal: controller.signal },
                    );
                    const json = await res.json();
                    if (!cancelled) {
                        setAreaSuggestions(((json.features ?? []) as MapboxFeature[]).map((f) => ({ kind: "zip" as const, feature: f })));
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") return;
                    if (!cancelled) setAreaSuggestions([]);
                }
            } else if (areaType === "neighborhood") {
                try {
                    const b = mapBoundsRef.current;
                    const mapCenter = b ? { p_lat: (b.south + b.north) / 2, p_lng: (b.west + b.east) / 2 } : {};
                    const data = await searchNeighborhoods({ p_query: areaInput, ...mapCenter }, { signal: controller.signal });
                    if (!cancelled) {
                        setAreaSuggestions(data.map((r) => ({ kind: "neighborhood" as const, ...r })));
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") return;
                    if (!cancelled) setAreaSuggestions([]);
                }
            } else if (areaType === "msa") {
                try {
                    const b = mapBoundsRef.current;
                    const mapCenter = b ? { p_lat: (b.south + b.north) / 2, p_lng: (b.west + b.east) / 2 } : {};
                    const data = await searchMsas({ p_query: areaInput, ...mapCenter }, { signal: controller.signal });
                    if (!cancelled) {
                        setAreaSuggestions(data.map((r) => ({ kind: "msa" as const, ...r })));
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") return;
                    if (!cancelled) setAreaSuggestions([]);
                }
            } else if (areaType === "address") {
                try {
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(areaInput)}.json?access_token=${MAPBOX_TOKEN}&types=address,poi&country=US&limit=6`,
                        { signal: controller.signal },
                    );
                    const json = await res.json();
                    if (!cancelled) {
                        setAreaSuggestions(((json.features ?? []) as MapboxFeature[]).map((f) => ({ kind: "address" as const, feature: f })));
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") return;
                    if (!cancelled) setAreaSuggestions([]);
                }
            } else {
                const mapboxType = areaType === "city" ? "place" : "district";
                try {
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(areaInput)}.json?access_token=${MAPBOX_TOKEN}&types=${mapboxType}&country=US&limit=6`,
                        { signal: controller.signal },
                    );
                    const json = await res.json();
                    if (!cancelled) {
                        setAreaSuggestions(((json.features ?? []) as MapboxFeature[]).map((f) => ({ kind: "mapbox" as const, feature: f })));
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") return;
                    if (!cancelled) setAreaSuggestions([]);
                }
            }
        }, 200);

        return () => {
            cancelled = true;
            suggestAbortControllerRef.current?.abort();
        };
    }, [areaInput, areaType, areaFilter]);

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const commitZip = async (zip: string) => {
        const v = zip.trim();
        if (!v) return;
        setAreaFilter({ type: "zip", label: v, zipCode: v });
        setShowSuggestions(false);
        const data = await getZipBoundary({ p_zip: v });
        if (data) setBoundaryGeoJSON(data);
    };

    const commitAddressText = (query: string) => {
        const v = query.trim();
        if (!v) return;
        setAreaFilter({ type: "address", label: v, addressQuery: v });
        setShowSuggestions(false);
    };

    const selectSuggestion = async (s: AreaSuggestion) => {
        setShowSuggestions(false);
        setAreaSuggestions([]);

        if (s.kind === "address") {
            const label = s.feature.place_name;
            const [lng, lat] = s.feature.center;
            // ~500m proximity radius in degrees (~0.005°)
            const PROXIMITY_DEG = 0.005;
            const bbox: MapBounds = {
                west: lng - PROXIMITY_DEG,
                east: lng + PROXIMITY_DEG,
                south: lat - PROXIMITY_DEG,
                north: lat + PROXIMITY_DEG,
            };
            setAreaInput(label);
            setAreaFilter({ type: "address", label, bbox });
            setFitBoundsTarget(bbox);
        } else if (s.kind === "zip") {
            const zip = s.feature.text;
            const mb = s.feature.bbox;
            const bbox: MapBounds | undefined = mb ? { west: mb[0], south: mb[1], east: mb[2], north: mb[3] } : undefined;
            setAreaInput(zip);
            setAreaFilter({ type: "zip", label: zip, zipCode: zip, bbox });
            if (bbox) setFitBoundsTarget(bbox);
            const data = await getZipBoundary({ p_zip: zip });
            if (data) setBoundaryGeoJSON(data);
        } else if (s.kind === "neighborhood") {
            const [bboxRow, geojsonData] = await Promise.all([getNeighborhoodBbox({ p_neighborhood_id: s.id }), getNeighborhoodGeojson({ p_id: s.id })]);
            const bbox: MapBounds | undefined = bboxRow ? { west: bboxRow.west, south: bboxRow.south, east: bboxRow.east, north: bboxRow.north } : undefined;
            const label = `${s.name} · ${s.city}`;
            setAreaInput(label);
            setAreaFilter({ type: "neighborhood", label, neighborhoodId: s.id, bbox });
            if (bbox) setFitBoundsTarget(bbox);
            if (geojsonData) setBoundaryGeoJSON(geojsonData);
        } else if (s.kind === "msa") {
            const [bboxRow, geojsonData] = await Promise.all([getMsaBbox({ p_geoid: s.geoid }), getMsaGeojson({ p_geoid: s.geoid })]);
            const bbox: MapBounds | undefined = bboxRow ? { west: bboxRow.west, south: bboxRow.south, east: bboxRow.east, north: bboxRow.north } : undefined;
            const label = s.name_lsad || s.name;
            setAreaInput(label);
            setAreaFilter({ type: "msa", label, msaGeoid: s.geoid, bbox });
            if (bbox) setFitBoundsTarget(bbox);
            if (geojsonData) setBoundaryGeoJSON(geojsonData);
        } else {
            const feature = s.feature;
            const regionCtx = feature.context?.find((c) => c.id.startsWith("region."));
            const stateCode = regionCtx?.short_code?.replace("US-", "") ?? "";
            const mb = feature.bbox;
            const bbox: MapBounds | undefined = mb ? { west: mb[0], south: mb[1], east: mb[2], north: mb[3] } : undefined;
            if (areaType === "city") {
                const label = stateCode ? `${feature.text}, ${stateCode}` : feature.text;
                setAreaInput(label);
                setAreaFilter({ type: "city", label, cityName: feature.text, cityState: stateCode, bbox });
                if (bbox) setFitBoundsTarget(bbox);
                const data = await getCityGeojson({ p_name: feature.text, p_state: stateCode });
                if (data) setBoundaryGeoJSON(data);
            } else {
                // county
                const label = stateCode ? `${feature.text}, ${stateCode}` : feature.text;
                setAreaInput(label);
                setAreaFilter({ type: "county", label, countyName: feature.text, countyState: stateCode, bbox });
                if (bbox) setFitBoundsTarget(bbox);
                const data = await getCountyGeojson({ p_name: feature.text, p_state: stateCode });
                if (data) setBoundaryGeoJSON(data);
            }
        }
    };

    const fetchProperties = useCallback(
        async (activeAreaFilter: AreaFilter | null, currentFilters: Filters, source: MapListingSource, bounds: MapBounds | null, latestOnly: boolean) => {
            setLoading(true);

            // Loopnet: still server-side filtered (no edge caching concern, result set is small)
            if (source === "loopnet") {
                const effectiveBounds = activeAreaFilter?.bbox ?? bounds;
                const params = new URLSearchParams();
                if (latestOnly) params.set("latest_only", "1");
                if (activeAreaFilter?.zipCode) params.set("zip", activeAreaFilter.zipCode);
                else if (activeAreaFilter?.cityName) params.set("city", activeAreaFilter.cityName);
                else if (activeAreaFilter?.countyName) params.set("county", activeAreaFilter.countyName);
                else if (activeAreaFilter?.addressQuery) params.set("address_query", activeAreaFilter.addressQuery);
                if (currentFilters.priceMin) params.set("price_min", currentFilters.priceMin);
                if (currentFilters.priceMax) params.set("price_max", currentFilters.priceMax);
                if (currentFilters.capRateMin) params.set("cap_rate_min", currentFilters.capRateMin);
                if (currentFilters.capRateMax) params.set("cap_rate_max", currentFilters.capRateMax);
                if (currentFilters.sqftMin) params.set("sqft_min", currentFilters.sqftMin);
                if (currentFilters.sqftMax) params.set("sqft_max", currentFilters.sqftMax);
                if (effectiveBounds) {
                    params.set("bounds_west", String(effectiveBounds.west));
                    params.set("bounds_east", String(effectiveBounds.east));
                    params.set("bounds_south", String(effectiveBounds.south));
                    params.set("bounds_north", String(effectiveBounds.north));
                }
                try {
                    const response = await fetch(`/api/listings/loopnet?${params.toString()}`);
                    const json = response.ok ? await response.json() : { data: [], count: 0 };
                    const rows = (json.data ?? []).map((item: Record<string, unknown>) => mapLoopnetRow(item));
                    setProperties(rows.map(({ _createdAt: _, ...p }: any) => p));
                    setTotalCount(json.count ?? 0);
                } catch (err) {
                    console.error("Error fetching loopnet listings:", err);
                }
                setLoading(false);
                return;
            }

            if (source === "zillow") {
                const effectiveBounds = activeAreaFilter?.bbox ?? bounds;
                try {
                    const filterKey = buildZillowFilterKey(activeAreaFilter, currentFilters, latestOnly);
                    const existing = zillowCacheRef.current.get(filterKey);
                    const requestedBounds = effectiveBounds ? snapBounds(effectiveBounds) : null;
                    const boundsToFetch = requestedBounds
                        ? existing
                            ? getUncoveredBounds(requestedBounds, existing.coveredBounds)
                            : [requestedBounds]
                        : [null];
                    const deltaBoundsToFetch = boundsToFetch.filter((deltaBounds): deltaBounds is MapBounds => deltaBounds !== null);

                    if (boundsToFetch.length === 0) {
                        setAllZillowRows(existing?.rows ?? []);
                        setLoading(false);
                        return;
                    }

                    const responses = await Promise.all(
                        boundsToFetch.map((deltaBounds) =>
                            fetchZillowListings({
                                zip: activeAreaFilter?.zipCode ?? null,
                                city: activeAreaFilter?.cityName ?? null,
                                addressQuery: activeAreaFilter?.addressQuery ?? null,
                                latestOnly,
                                priceMin: currentFilters.priceMin ? parseFloat(currentFilters.priceMin) || null : null,
                                priceMax: currentFilters.priceMax ? parseFloat(currentFilters.priceMax) || null : null,
                                sqftMin: currentFilters.sqftMin ? parseFloat(currentFilters.sqftMin) || null : null,
                                sqftMax: currentFilters.sqftMax ? parseFloat(currentFilters.sqftMax) || null : null,
                                beds: currentFilters.beds.length > 0 ? currentFilters.beds : null,
                                bathsMin: currentFilters.bathsMin ?? null,
                                laundry: currentFilters.laundry.length > 0 ? currentFilters.laundry : null,
                                propertyType: currentFilters.propertyType,
                                bounds: deltaBounds,
                            }),
                        ),
                    );

                    const seen = new Set(existing?.rows.map((row) => row.id) ?? []);
                    const merged = [...(existing?.rows ?? [])];

                    for (const rows of responses) {
                        for (const row of rows) {
                            if (!seen.has(row.id)) {
                                seen.add(row.id);
                                merged.push(row);
                            }
                        }
                    }

                    if (requestedBounds) {
                        const coveredBounds = existing
                            ? deltaBoundsToFetch.reduce((union, deltaBounds) => expandBounds(union, deltaBounds), existing.coveredBounds)
                            : deltaBoundsToFetch.reduce(expandBounds);
                        zillowCacheRef.current.set(filterKey, { rows: merged, coveredBounds });
                    }

                    setAllZillowRows(merged);
                } catch (error) {
                    console.error("Error fetching zillow map listings:", error);
                    setAllZillowRows([]);
                }
                setLoading(false);
                return;
            }

            setLoading(false);
        },
        [],
    );

    const handleBoundsChange = useCallback((bounds: MapBounds) => {
        mapBoundsRef.current = bounds;
        if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
        boundsTimerRef.current = setTimeout(() => {
            setMapBounds(bounds);
        }, 300);
    }, []);

    const handleViewChange = useCallback(
        (lat: number, lng: number, zoom: number) => {
            const params = new URLSearchParams(window.location.search);
            params.set("lat", lat.toFixed(5));
            params.set("lng", lng.toFixed(5));
            params.set("zoom", zoom.toFixed(2));
            router.replace(`?${params.toString()}`, { scroll: false });
        },
        [router],
    );

    // Sync all filter/area state to URL
    useEffect(() => {
        const params = buildMapSearchParams({
            baseParams: new URLSearchParams(window.location.search),
            filters,
            mapListingSource,
            showLatestOnly,
            areaType,
            areaFilter,
            listingsViewMode,
        });
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [filters, mapListingSource, showLatestOnly, areaType, areaFilter, listingsViewMode, router]);

    // Restore boundary GeoJSON when areaFilter is hydrated from URL on mount
    useEffect(() => {
        if (!areaFilter) return;
        (async () => {
            if (areaFilter.type === "zip" && areaFilter.zipCode) {
                const data = await getZipBoundary({ p_zip: areaFilter.zipCode });
                if (data) setBoundaryGeoJSON(data);
            } else if (areaFilter.type === "neighborhood" && areaFilter.neighborhoodId != null) {
                const data = await getNeighborhoodGeojson({ p_id: areaFilter.neighborhoodId });
                if (data) setBoundaryGeoJSON(data);
            } else if (areaFilter.type === "msa" && areaFilter.msaGeoid) {
                const data = await getMsaGeojson({ p_geoid: areaFilter.msaGeoid });
                if (data) setBoundaryGeoJSON(data);
            } else if (areaFilter.type === "city" && areaFilter.cityName) {
                const data = await getCityGeojson({ p_name: areaFilter.cityName, p_state: areaFilter.cityState ?? "" });
                if (data) setBoundaryGeoJSON(data);
            } else if (areaFilter.type === "county" && areaFilter.countyName) {
                const data = await getCountyGeojson({ p_name: areaFilter.countyName, p_state: areaFilter.countyState ?? "" });
                if (data) setBoundaryGeoJSON(data);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Apply client-side viewport filter whenever the fetched Zillow rows or map bounds change.
    // No network request — just a JS array filter over the already-fetched rows.
    useEffect(() => {
        if (mapListingSource !== "zillow") return;
        const effectiveBounds = areaFilter?.bbox ?? mapBounds;
        const visible = filterToViewport(allZillowRows, effectiveBounds);
        setProperties(
            visible.map((row) => {
                const { _createdAt: _, ...p } = mapZillowRpcRow(row);
                return p;
            }),
        );
        setTotalCount(visible.length);
    }, [allZillowRows, mapBounds, areaFilter, mapListingSource]);

    // Compute the snapped bounds so we can use them as the effect dependency.
    // Panning within the same 0.1° tile produces the same snappedKey → no re-fetch.
    const snappedBounds = useMemo(() => {
        const b = areaFilter?.bbox ?? mapBounds;
        return b ? snapBounds(b) : null;
    }, [areaFilter, mapBounds]);

    const snappedBoundsKey = useMemo(() => {
        if (!snappedBounds) return null;
        return `${snappedBounds.south},${snappedBounds.north},${snappedBounds.west},${snappedBounds.east}`;
    }, [snappedBounds]);

    // Zillow: re-fetch when non-spatial params or the snapped bbox tile changes,
    // but skip the fetch if the current viewport is already covered by cached data.
    useEffect(() => {
        if (mapListingSource !== "zillow") return;
        if (!snappedBoundsKey) return;
        const b = areaFilter?.bbox ?? mapBounds;
        if (!b) return;

        const filterKey = buildZillowFilterKey(areaFilter, filters, showLatestOnly);
        const cached = zillowCacheRef.current.get(filterKey);

        if (cached && snappedBounds && boundsContainedIn(snappedBounds, cached.coveredBounds)) {
            setAllZillowRows(cached.rows);
            setLoading(false);
            return;
        }

        fetchProperties(areaFilter, filters, mapListingSource, b, showLatestOnly);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snappedBoundsKey, areaFilter, filters, mapListingSource, showLatestOnly, fetchProperties]);

    // Loopnet: server-side bbox filtering, re-fetch on bounds changes too.
    useEffect(() => {
        if (mapListingSource !== "loopnet") return;
        if (!areaFilter && !mapBounds) return;
        fetchProperties(areaFilter, filters, mapListingSource, areaFilter ? null : mapBounds, showLatestOnly);
    }, [areaFilter, filters, mapListingSource, mapBounds, showLatestOnly, fetchProperties]);

    const filtersDialogInner = (
        <div className="max-h-[min(70vh,28rem)] space-y-6 overflow-y-auto pr-1">
            <div className="lg:hidden">
                <Label className="text-xs text-muted-foreground">Listing type</Label>
                <div className="mt-2 flex gap-1 rounded-lg bg-muted p-1">
                    {(["zillow", "loopnet"] as const).map((source) => (
                        <button
                            key={source}
                            type="button"
                            onClick={() => setMapListingSource(source)}
                            className={cn(
                                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                mapListingSource === source ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {source === "loopnet" ? "Sales" : "Rent"}
                        </button>
                    ))}
                </div>
            </div>
            <div className="lg:hidden">
                <Label className="text-xs text-muted-foreground">Time range</Label>
                <div className="mt-2 flex gap-1 rounded-lg bg-muted p-1">
                    {([true, false] as const).map((latest) => (
                        <button
                            key={String(latest)}
                            type="button"
                            onClick={() => setShowLatestOnly(latest)}
                            className={cn(
                                "flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors",
                                showLatestOnly === latest ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {latest ? "Latest" : "Historical"}
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-3 border-t border-border pt-4 lg:border-t-0 lg:pt-0">
                {mapListingSource === "zillow" && (
                    <div>
                        <Label className="text-xs">Bedrooms</Label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {BED_OPTIONS.map(({ label, value }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            beds: prev.beds.includes(value) ? prev.beds.filter((b) => b !== value) : [...prev.beds, value],
                                        }))
                                    }
                                    className={cn(
                                        "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                        filters.beds.includes(value)
                                            ? "border-blue-600 bg-blue-600 text-white"
                                            : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {mapListingSource === "zillow" && (
                    <div>
                        <Label className="text-xs">Bathrooms (min)</Label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {BATH_OPTIONS.map(({ label, value }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            bathsMin: prev.bathsMin === value ? null : value,
                                        }))
                                    }
                                    className={cn(
                                        "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                        filters.bathsMin === value
                                            ? "border-blue-600 bg-blue-600 text-white"
                                            : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {mapListingSource === "zillow" && (
                    <div>
                        <Label className="text-xs">Laundry</Label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {LAUNDRY_OPTIONS.map(({ label, value }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            laundry: prev.laundry.includes(value) ? prev.laundry.filter((v) => v !== value) : [...prev.laundry, value],
                                        }))
                                    }
                                    className={cn(
                                        "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                        filters.laundry.includes(value)
                                            ? "border-blue-600 bg-blue-600 text-white"
                                            : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {mapListingSource === "zillow" && (
                    <div>
                        <Label className="text-xs">Segment</Label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {(
                                [
                                    ["both", "All"],
                                    ["reit", "REIT"],
                                    ["mid", "Mid-market"],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setFilters((prev) => ({ ...prev, propertyType: value }))}
                                    className={cn(
                                        "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                        filters.propertyType === value
                                            ? "border-blue-600 bg-blue-600 text-white"
                                            : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div>
                    <Label className="text-xs">Price Range</Label>
                    <div className="mt-1 flex gap-2">
                        <Input
                            type="number"
                            placeholder="Min"
                            value={filters.priceMin}
                            onChange={(e) => {
                                setFilters((prev) => ({ ...prev, priceMin: e.target.value }));
                            }}
                            className="h-8 text-xs"
                        />
                        <Input
                            type="number"
                            placeholder="Max"
                            value={filters.priceMax}
                            onChange={(e) => {
                                setFilters((prev) => ({ ...prev, priceMax: e.target.value }));
                            }}
                            className="h-8 text-xs"
                        />
                    </div>
                </div>
                <div>
                    <Label className="text-xs">Sq ft</Label>
                    <div className="mt-1 flex gap-2">
                        <Input
                            type="number"
                            placeholder="Min"
                            value={filters.sqftMin}
                            onChange={(e) => {
                                setFilters((prev) => ({ ...prev, sqftMin: e.target.value }));
                            }}
                            className="h-8 text-xs"
                        />
                        <Input
                            type="number"
                            placeholder="Max"
                            value={filters.sqftMax}
                            onChange={(e) => {
                                setFilters((prev) => ({ ...prev, sqftMax: e.target.value }));
                            }}
                            className="h-8 text-xs"
                        />
                    </div>
                </div>
                {mapListingSource === "loopnet" && (
                    <div>
                        <Label className="text-xs">Cap Rate (%)</Label>
                        <div className="mt-1 flex gap-2">
                            <Input
                                type="number"
                                placeholder="Min"
                                value={filters.capRateMin}
                                onChange={(e) => {
                                    setFilters((prev) => ({ ...prev, capRateMin: e.target.value }));
                                }}
                                className="h-8 text-xs"
                            />
                            <Input
                                type="number"
                                placeholder="Max"
                                value={filters.capRateMax}
                                onChange={(e) => {
                                    setFilters((prev) => ({ ...prev, capRateMax: e.target.value }));
                                }}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const areaSearchField =
        areaFilter && (areaFilter.type !== "address" || areaFilter.bbox) ? (
            <div className="flex min-h-10 min-w-0 flex-1 items-center gap-1.5 border-l border-input bg-blue-50/80 px-3 py-2 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                <MapPin className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="min-w-0 flex-1 truncate">{areaFilter.label}</span>
                <button
                    type="button"
                    onClick={clearAreaFilter}
                    className="shrink-0 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
                    aria-label="Clear area"
                >
                    <X className="size-4" />
                </button>
            </div>
        ) : (
            <div className="relative min-h-10 min-w-0 flex-1" ref={inputWrapperRef}>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    inputMode={areaType === "zip" ? "numeric" : "text"}
                    placeholder={AREA_TYPE_PLACEHOLDERS[areaType]}
                    className={cn(
                        "h-10 rounded-none rounded-r-lg border-0 pl-9 shadow-none focus-visible:ring-0",
                        areaType === "address" && areaInput && "pr-9",
                    )}
                    value={areaInput}
                    onChange={(e) => setAreaInput(e.target.value)}
                    onFocus={() => {
                        if (areaSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && areaType === "zip") {
                            commitZip(areaInput);
                        } else if (e.key === "Enter" && areaType === "address") {
                            commitAddressText(areaInput);
                        } else if (e.key === "Escape") {
                            setShowSuggestions(false);
                        }
                    }}
                    aria-label="Area search"
                />
                {areaType === "address" && areaInput && (
                    <button
                        type="button"
                        onClick={clearAreaFilter}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
                {showSuggestions && areaSuggestions.length > 0 && (
                    <ul className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-hidden overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        {areaSuggestions.map((s, i) => {
                            const label =
                                s.kind === "neighborhood"
                                    ? `${s.name} · ${s.city}, ${s.state}`
                                    : s.kind === "msa"
                                      ? s.name_lsad || s.name
                                      : s.kind === "zip"
                                        ? s.feature.place_name
                                        : s.feature.place_name;
                            return (
                                <li
                                    key={i}
                                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectSuggestion(s);
                                    }}
                                >
                                    <MapPin className="size-3 shrink-0 text-gray-400" />
                                    <span className="truncate">{label}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        );

    return (
        <Dialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-shrink-0 flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between gap-2 lg:hidden">
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="relative gap-2">
                                <Filter className="size-4" />
                                Filters
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </Button>
                        </DialogTrigger>

                        <div className="flex rounded-lg border border-input bg-muted/40 p-0.5">
                            <button
                                type="button"
                                onClick={() => setListingsViewMode("map")}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                    listingsViewMode === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                                )}
                            >
                                <MapIcon className="size-4" />
                                Map
                            </button>
                            <button
                                type="button"
                                onClick={() => setListingsViewMode("list")}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                    listingsViewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                                )}
                            >
                                <LayoutList className="size-4" />
                                List
                            </button>
                        </div>
                    </div>

                    <div className="flex w-full min-w-0 rounded-lg border border-input shadow-xs">
                        <Select
                            value={areaType}
                            onValueChange={(v) => {
                                const next = v as AreaType;
                                setAreaType(next);
                                setAreaFilter(null);
                                setAreaInput("");
                                setAreaSuggestions([]);
                                setShowSuggestions(false);
                            }}
                        >
                            <SelectTrigger
                                className="!h-10 w-[min(38%,11rem)] shrink-0 rounded-none rounded-l-lg border-0 border-r bg-muted/30 shadow-none focus:z-10"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.keys(AREA_TYPE_LABELS) as AreaType[]).map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {AREA_TYPE_LABELS[type]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {areaSearchField}
                    </div>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <PropertiesSidebar
                        properties={properties}
                        selectedId={selectedId}
                        loading={loading}
                        totalCount={totalCount}
                        onSelect={setSelectedId}
                        className={cn(listingsViewMode === "list" ? "flex flex-1 lg:w-72" : "hidden lg:flex", "max-lg:min-h-0 max-lg:flex-1")}
                    />

                    <div className={cn("relative min-h-0 flex-1", listingsViewMode === "map" ? "flex flex-col" : "hidden lg:flex")}>
                        <PropertyMap
                            properties={properties}
                            selectedId={selectedId}
                            className="absolute inset-0"
                            initialCenter={initialCenter}
                            initialZoom={initialZoom}
                            fitBoundsTarget={fitBoundsTarget}
                            boundaryGeoJSON={boundaryGeoJSON}
                            addressPin={
                                areaFilter?.type === "address" && areaFilter.bbox && !areaFilter.addressQuery
                                    ? [(areaFilter.bbox.west + areaFilter.bbox.east) / 2, (areaFilter.bbox.south + areaFilter.bbox.north) / 2]
                                    : null
                            }
                            onBoundsChange={handleBoundsChange}
                            onViewChange={handleViewChange}
                        />
                        <div className="absolute top-3 left-3 z-10 hidden items-center gap-2 lg:flex">
                            <DialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="relative bg-background/95 shadow-sm backdrop-blur-sm"
                                    aria-label={`Filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ""}`}
                                >
                                    <Filter className="size-4" />
                                    {activeFilterCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </Button>
                            </DialogTrigger>
                            <div className="flex rounded-lg bg-muted p-0.5 shadow-sm">
                                {(["zillow", "loopnet"] as const).map((source) => (
                                    <button
                                        key={source}
                                        type="button"
                                        onClick={() => setMapListingSource(source)}
                                        className={cn(
                                            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                            mapListingSource === source
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        {source === "loopnet" ? "Sales" : "Rent"}
                                    </button>
                                ))}
                            </div>
                            <div className="flex rounded-lg bg-muted p-0.5 shadow-sm">
                                {([true, false] as const).map((latest) => (
                                    <button
                                        key={String(latest)}
                                        type="button"
                                        onClick={() => setShowLatestOnly(latest)}
                                        className={cn(
                                            "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                                            showLatestOnly === latest
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        {latest ? "Latest" : "Historical"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-2 pr-8">
                        <DialogTitle>Filters</DialogTitle>
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto shrink-0 px-2 py-1 text-xs">
                                Clear all
                            </Button>
                        )}
                    </div>
                    <DialogDescription className="sr-only">Listing type, time range, and property filters</DialogDescription>
                </DialogHeader>
                {filtersDialogInner}
            </DialogContent>
        </Dialog>
    );
}

export default function MapPage() {
    return (
        <Suspense>
            <MapPageInner />
        </Suspense>
    );
}
