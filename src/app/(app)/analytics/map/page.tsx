"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Filter, MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type MapBounds, type Property, PropertyMap } from "@/components/application/map/property-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    getCityGeojson,
    getCountyGeojson,
    getMsaBbox,
    getMsaGeojson,
    getNeighborhoodBbox,
    getNeighborhoodGeojson,
    getZillowMapListings,
    getZipBoundary,
    searchMsas,
    searchNeighborhoods,
} from "@/db/rpc";
import {
    AREA_TYPE_LABELS,
    AREA_TYPE_PLACEHOLDERS,
    BATH_OPTIONS,
    BED_OPTIONS,
    buildMapSearchParams,
    countActiveMapFilters,
    createDefaultMapFilters,
    parseAreaFilter,
    parseAreaType,
    parseMapFilters,
    parseMapListingSource,
    parseShowLatestOnly,
    type AreaFilter,
    type AreaType,
    type Filters,
    type MapListingSource,
} from "@/lib/analytics/map-page";
import { mapLoopnetRow, mapZillowRpcRow } from "@/lib/map-listings";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

type AreaSuggestion =
    | { kind: "neighborhood"; id: number; name: string; city: string; state: string }
    | { kind: "mapbox"; feature: MapboxFeature }
    | { kind: "msa"; id: number; geoid: string; name: string; name_lsad: string }
    | { kind: "zip"; feature: MapboxFeature };

interface MapboxFeature {
    id: string;
    text: string;
    place_name: string;
    center: [number, number];
    bbox?: [number, number, number, number];
    context?: Array<{ id: string; text: string; short_code?: string }>;
}

function PropertiesListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-3">
                    <div className="flex gap-3">
                        <div className="h-12 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1">
                            <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                            <div className="mt-2 h-2 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                            <div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
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

    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [filters, setFilters] = useState<Filters>(() => parseMapFilters(searchParams));
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [mapListingSource, setMapListingSource] = useState<MapListingSource>(() => parseMapListingSource(searchParams));
    const [showLatestOnly, setShowLatestOnly] = useState<boolean>(() => parseShowLatestOnly(searchParams));
    const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
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
    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);

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

        // Address type: debounce the filter directly, no dropdown suggestions
        if (areaType === "address") {
            const q = areaInput.trim();
            // Bail if the filter already matches — prevents infinite re-render loop
            if ((q && areaFilter?.addressQuery === q) || (!q && !areaFilter)) return;
            suggestTimerRef.current = setTimeout(() => {
                setAreaFilter(q ? { type: "address", label: q, addressQuery: q } : null);
            }, 500);
            return;
        }

        if (areaFilter || areaInput.length < 2) {
            setAreaSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        suggestTimerRef.current = setTimeout(async () => {
            if (areaType === "zip") {
                try {
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(areaInput)}.json?access_token=${MAPBOX_TOKEN}&types=postcode&country=US&limit=6`,
                    );
                    const json = await res.json();
                    setAreaSuggestions(((json.features ?? []) as MapboxFeature[]).map((f) => ({ kind: "zip" as const, feature: f })));
                    setShowSuggestions(true);
                } catch {
                    setAreaSuggestions([]);
                }
            } else if (areaType === "neighborhood") {
                const data = await searchNeighborhoods({ p_query: areaInput });
                setAreaSuggestions(data.map((r) => ({ kind: "neighborhood" as const, ...r })));
                setShowSuggestions(true);
            } else if (areaType === "msa") {
                const data = await searchMsas({ p_query: areaInput });
                setAreaSuggestions(data.map((r) => ({ kind: "msa" as const, ...r })));
                setShowSuggestions(true);
            } else {
                const mapboxType = areaType === "city" ? "place" : "district";
                try {
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(areaInput)}.json?access_token=${MAPBOX_TOKEN}&types=${mapboxType}&country=US&limit=6`,
                    );
                    const json = await res.json();
                    setAreaSuggestions(((json.features ?? []) as MapboxFeature[]).map((f) => ({ kind: "mapbox" as const, feature: f })));
                    setShowSuggestions(true);
                } catch {
                    setAreaSuggestions([]);
                }
            }
        }, 300);
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

    const selectSuggestion = async (s: AreaSuggestion) => {
        setShowSuggestions(false);
        setAreaSuggestions([]);

        if (s.kind === "zip") {
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

            // Which bounds to use for geographic clipping
            const effectiveBounds = activeAreaFilter?.bbox ?? bounds;

            if (source === "loopnet") {
                const { data: latestRun } = await supabase.from("loopnet_listings").select("run_id").order("run_id", { ascending: false }).limit(1).single();
                let loopnetQuery = supabase
                    .from("loopnet_listings")
                    .select("*", { count: "exact" })
                    .not("latitude", "is", null)
                    .not("longitude", "is", null)
                    .order("created_at", { ascending: false });
                if (latestOnly && latestRun?.run_id != null) {
                    loopnetQuery = loopnetQuery.eq("run_id", latestRun.run_id);
                }
                // Area filter
                if (activeAreaFilter?.zipCode) {
                    loopnetQuery = loopnetQuery.or(`address.ilike.%${activeAreaFilter.zipCode}%,location.ilike.%${activeAreaFilter.zipCode}%`);
                } else if (activeAreaFilter?.cityName) {
                    loopnetQuery = loopnetQuery.ilike("location", `%${activeAreaFilter.cityName}%`);
                } else if (activeAreaFilter?.countyName) {
                    loopnetQuery = loopnetQuery.or(`address.ilike.%${activeAreaFilter.countyName}%,location.ilike.%${activeAreaFilter.countyName}%`);
                } else if (activeAreaFilter?.addressQuery) {
                    loopnetQuery = loopnetQuery.or(
                        `headline.ilike.%${activeAreaFilter.addressQuery}%,address.ilike.%${activeAreaFilter.addressQuery}%,location.ilike.%${activeAreaFilter.addressQuery}%`,
                    );
                }
                // Price / cap-rate / sqft filters
                if (currentFilters.priceMin) {
                    const v = parseFloat(currentFilters.priceMin);
                    if (!isNaN(v)) loopnetQuery = loopnetQuery.gte("numeric_price", v);
                }
                if (currentFilters.priceMax) {
                    const v = parseFloat(currentFilters.priceMax);
                    if (!isNaN(v)) loopnetQuery = loopnetQuery.lte("numeric_price", v);
                }
                if (currentFilters.capRateMin) {
                    const v = parseFloat(currentFilters.capRateMin);
                    if (!isNaN(v)) loopnetQuery = loopnetQuery.gte("numeric_cap_rate", v);
                }
                if (currentFilters.capRateMax) {
                    const v = parseFloat(currentFilters.capRateMax);
                    if (!isNaN(v)) loopnetQuery = loopnetQuery.lte("numeric_cap_rate", v);
                }
                if (currentFilters.sqftMin) {
                    const v = parseFloat(currentFilters.sqftMin);
                    if (!isNaN(v)) loopnetQuery = loopnetQuery.gte("numeric_square_footage", v);
                }
                if (currentFilters.sqftMax) {
                    const v = parseFloat(currentFilters.sqftMax);
                    if (!isNaN(v)) loopnetQuery = loopnetQuery.lte("numeric_square_footage", v);
                }
                if (effectiveBounds) {
                    loopnetQuery = loopnetQuery
                        .gte("latitude", effectiveBounds.south)
                        .lte("latitude", effectiveBounds.north)
                        .gte("longitude", effectiveBounds.west)
                        .lte("longitude", effectiveBounds.east);
                }
                const { data, error, count } = await loopnetQuery;
                if (error) console.error("Error fetching loopnet listings:", error);
                const rows = (data ?? []).map((item) => mapLoopnetRow(item as Record<string, unknown>));
                setProperties(rows.map(({ _createdAt: _, ...p }) => p));
                setTotalCount(count ?? 0);
                setLoading(false);
                return;
            }

            if (source === "zillow") {
                try {
                    const rows = await getZillowMapListings({
                        p_zip: activeAreaFilter?.zipCode ?? null,
                        p_city: activeAreaFilter?.cityName ?? null,
                        p_address_query: activeAreaFilter?.addressQuery ?? null,
                        p_latest_only: latestOnly,
                        p_price_min: currentFilters.priceMin ? parseFloat(currentFilters.priceMin) || null : null,
                        p_price_max: currentFilters.priceMax ? parseFloat(currentFilters.priceMax) || null : null,
                        p_sqft_min: currentFilters.sqftMin ? parseFloat(currentFilters.sqftMin) || null : null,
                        p_sqft_max: currentFilters.sqftMax ? parseFloat(currentFilters.sqftMax) || null : null,
                        p_beds: currentFilters.beds.length > 0 ? currentFilters.beds : null,
                        p_baths_min: currentFilters.bathsMin ?? null,
                        p_home_types: null,
                        p_property_type: currentFilters.propertyType,
                        p_bounds_south: effectiveBounds?.south ?? null,
                        p_bounds_north: effectiveBounds?.north ?? null,
                        p_bounds_west: effectiveBounds?.west ?? null,
                        p_bounds_east: effectiveBounds?.east ?? null,
                    });
                    setProperties(
                        rows.map((row) => {
                            const { _createdAt: _, ...p } = mapZillowRpcRow(row);
                            return p;
                        }),
                    );
                    setTotalCount(rows.length > 0 ? rows[0].total_count : 0);
                } catch (error) {
                    console.error("Error fetching zillow map listings:", error);
                }
                setLoading(false);
                return;
            }

            setLoading(false);
        },
        [],
    );

    const handleBoundsChange = useCallback((bounds: MapBounds) => {
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
        });
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [filters, mapListingSource, showLatestOnly, areaType, areaFilter, router]);

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

    useEffect(() => {
        if (!areaFilter && !mapBounds) return;
        fetchProperties(areaFilter, filters, mapListingSource, areaFilter ? null : mapBounds, showLatestOnly);
    }, [areaFilter, filters, mapListingSource, mapBounds, showLatestOnly, fetchProperties]);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Map Controls Bar */}
            <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                {/* Sales vs Rent toggle */}
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                    {(["zillow", "loopnet"] as const).map((source) => (
                        <button
                            key={source}
                            onClick={() => {
                                setMapListingSource(source);
                            }}
                            className={cn(
                                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                                mapListingSource === source
                                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                                    : "text-gray-600 dark:text-gray-400",
                            )}
                        >
                            {source === "loopnet" ? "Sales" : "Rent"}
                        </button>
                    ))}
                </div>

                {/* Latest / Historical toggle */}
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                    {([true, false] as const).map((latest) => (
                        <button
                            key={String(latest)}
                            onClick={() => setShowLatestOnly(latest)}
                            className={cn(
                                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                                showLatestOnly === latest
                                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                                    : "text-gray-600 dark:text-gray-400",
                            )}
                        >
                            {latest ? "Latest" : "Historical"}
                        </button>
                    ))}
                </div>

                {/* Area type selector + search */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {/* Area type buttons */}
                    <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 text-xs dark:border-gray-600">
                        {(Object.keys(AREA_TYPE_LABELS) as AreaType[]).map((type, i) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => {
                                    setAreaType(type);
                                    setAreaFilter(null);
                                    setAreaInput("");
                                    setAreaSuggestions([]);
                                }}
                                className={cn(
                                    "px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors",
                                    i > 0 && "border-l border-gray-200 dark:border-gray-600",
                                    areaType === type
                                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700",
                                )}
                            >
                                {AREA_TYPE_LABELS[type]}
                            </button>
                        ))}
                    </div>

                    {/* Search input or committed area chip */}
                    {areaFilter && areaFilter.type !== "address" ? (
                        <div className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            <MapPin className="size-3 flex-shrink-0" />
                            <span className="max-w-[180px] truncate">{areaFilter.label}</span>
                            <button type="button" onClick={clearAreaFilter} className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200">
                                <X className="size-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="relative max-w-xs flex-1" ref={inputWrapperRef}>
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                inputMode={areaType === "zip" ? "numeric" : "text"}
                                placeholder={AREA_TYPE_PLACEHOLDERS[areaType]}
                                className={cn(
                                    "h-8 border-gray-200 bg-gray-50 pl-9 text-sm dark:border-gray-700 dark:bg-gray-800",
                                    areaType === "address" && areaInput && "pr-8",
                                )}
                                value={areaInput}
                                onChange={(e) => setAreaInput(e.target.value)}
                                onFocus={() => {
                                    if (areaSuggestions.length > 0) setShowSuggestions(true);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && areaType === "zip") {
                                        commitZip(areaInput);
                                    } else if (e.key === "Escape") {
                                        setShowSuggestions(false);
                                    }
                                }}
                            />
                            {areaType === "address" && areaInput && (
                                <button
                                    type="button"
                                    onClick={clearAreaFilter}
                                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
                                                <MapPin className="size-3 flex-shrink-0 text-gray-400" />
                                                <span className="truncate">{label}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                {/* Filters Popover */}
                <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="relative h-8">
                            <Filter className="size-3.5" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">Filters</h3>
                                {activeFilterCount > 0 && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto px-2 py-1 text-xs">
                                        Clear all
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-3">
                                {mapListingSource === "zillow" && (
                                    <div>
                                        <Label className="text-xs">Bedrooms</Label>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            {BED_OPTIONS.map(({ label, value }) => (
                                                <button
                                                    key={value}
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
                                        <Label className="text-xs">Segment</Label>
                                        <div className="mt-1 flex gap-1.5">
                                            {(
                                                [
                                                    ["both", "All"],
                                                    ["reit", "REIT"],
                                                    ["mid", "Mid-market"],
                                                ] as const
                                            ).map(([value, label]) => (
                                                <button
                                                    key={value}
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
                                            className="h-7 text-xs"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Max"
                                            value={filters.priceMax}
                                            onChange={(e) => {
                                                setFilters((prev) => ({ ...prev, priceMax: e.target.value }));
                                            }}
                                            className="h-7 text-xs"
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
                                                className="h-7 text-xs"
                                            />
                                            <Input
                                                type="number"
                                                placeholder="Max"
                                                value={filters.capRateMax}
                                                onChange={(e) => {
                                                    setFilters((prev) => ({ ...prev, capRateMax: e.target.value }));
                                                }}
                                                className="h-7 text-xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Map Content */}
            <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
                {/* Sidebar */}
                <div className="z-10 flex h-1/2 w-full flex-col border-b border-gray-200 bg-white lg:h-full lg:w-72 lg:border-r lg:border-b-0 dark:border-gray-800 dark:bg-gray-900">
                    <div className="border-b border-gray-200 p-3 dark:border-gray-800">
                        <span className="text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                            {loading ? "Loading..." : `${totalCount.toLocaleString()} Results`}
                        </span>
                    </div>

                    <div className="flex-1 divide-y divide-gray-200 overflow-auto dark:divide-gray-800">
                        {loading ? (
                            <PropertiesListSkeleton count={4} />
                        ) : properties.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">No properties found</div>
                        ) : (
                            properties.map((property) => (
                                <div
                                    key={property.id}
                                    onClick={() => setSelectedId(property.id)}
                                    className={cn(
                                        "cursor-pointer p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800",
                                        selectedId === property.id && "bg-gray-50 dark:bg-gray-800",
                                    )}
                                >
                                    <Link href={`/analytics/listing/${property.id}`} className="group flex gap-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="h-12 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                                            {property.thumbnailUrl ? (
                                                <img src={property.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <Building2 className="size-4 text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1">
                                                <h4 className="flex-1 truncate text-xs font-medium text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                                                    {property.name}
                                                </h4>
                                                {property.isReit && (
                                                    <span className="flex-shrink-0 rounded bg-violet-100 px-1 py-0.5 text-[8px] font-bold text-violet-700">
                                                        REIT
                                                    </span>
                                                )}
                                            </div>
                                            <p className="truncate text-[10px] text-gray-500">{property.address}</p>
                                            <div className="mt-1 flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{property.price}</span>
                                                {property.isReit && property.units && <span className="text-[10px] text-gray-500">{property.units} units</span>}
                                                {property.capRate && <span className="text-[10px] text-gray-500">{property.capRate}</span>}
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Map */}
                <div className="relative flex-1">
                    <PropertyMap
                        properties={properties}
                        selectedId={selectedId}
                        className="absolute inset-0"
                        initialCenter={initialCenter}
                        initialZoom={initialZoom}
                        fitBoundsTarget={fitBoundsTarget}
                        boundaryGeoJSON={boundaryGeoJSON}
                        onBoundsChange={handleBoundsChange}
                        onViewChange={handleViewChange}
                    />
                </div>
            </div>
        </div>
    );
}

export default function MapPage() {
    return (
        <Suspense>
            <MapPageInner />
        </Suspense>
    );
}
