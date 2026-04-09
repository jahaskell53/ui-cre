"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, MoreVertical } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type AreaSuggestion, MapAreaSearchSection, MapFiltersFields, type MapboxFeature } from "@/app/(app)/analytics/map/map-page-controls";
import { PropertiesSidebar } from "@/app/(app)/analytics/map/properties-sidebar";
import { type MapBounds, type Property, PropertyMap } from "@/components/application/map/property-map";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    type AreaFilter,
    type AreaType,
    type Filters,
    type MapListingSource,
    buildMapSearchParams,
    countActiveMapFilters,
    createDefaultMapFilters,
    parseAreaFilter,
    parseAreaType,
    parseMapFilters,
    parseMapListingSource,
    parseMobileListingsPanel,
    parseShowLatestOnly,
} from "@/lib/analytics/map-page";
import { type ZillowMapListingRow, mapLoopnetRow, mapZillowRpcRow } from "@/lib/map-listings";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

// Snap a coordinate outward to a 0.1° grid to ensure the server-side bbox always
// contains the exact viewport. Client-side filterToViewport() trims to the exact edge.
function snapOut(value: number, direction: "floor" | "ceil"): number {
    return direction === "floor" ? Math.floor(value * 10) / 10 : Math.ceil(value * 10) / 10;
}

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
    sp.set("property_type", params.propertyType);
    if (params.bounds) {
        sp.set("bounds_south", String(snapOut(params.bounds.south, "floor")));
        sp.set("bounds_north", String(snapOut(params.bounds.north, "ceil")));
        sp.set("bounds_west", String(snapOut(params.bounds.west, "floor")));
        sp.set("bounds_east", String(snapOut(params.bounds.east, "ceil")));
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

function boundsContainedIn(
    inner: { south: number; north: number; west: number; east: number },
    outer: { south: number; north: number; west: number; east: number },
): boolean {
    return inner.south >= outer.south && inner.north <= outer.north && inner.west >= outer.west && inner.east <= outer.east;
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
        t: filters.propertyType,
    });
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
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [mapListingSource, setMapListingSource] = useState<MapListingSource>(() => parseMapListingSource(searchParams));
    const [showLatestOnly, setShowLatestOnly] = useState<boolean>(() => parseShowLatestOnly(searchParams));
    const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
    const [mobileListingsPanel, setMobileListingsPanel] = useState<"list" | "map">(() => parseMobileListingsPanel(searchParams));
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
            } else if (areaType === "address") {
                try {
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(areaInput)}.json?access_token=${MAPBOX_TOKEN}&types=address,poi&country=US&limit=6`,
                    );
                    const json = await res.json();
                    setAreaSuggestions(((json.features ?? []) as MapboxFeature[]).map((f) => ({ kind: "address" as const, feature: f })));
                    setShowSuggestions(true);
                } catch {
                    setAreaSuggestions([]);
                }
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
                    const rows = await fetchZillowListings({
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
                        propertyType: currentFilters.propertyType,
                        bounds: effectiveBounds,
                    });

                    const filterKey = buildZillowFilterKey(activeAreaFilter, currentFilters, latestOnly);
                    const fetchedBounds = effectiveBounds
                        ? {
                              south: snapOut(effectiveBounds.south, "floor"),
                              north: snapOut(effectiveBounds.north, "ceil"),
                              west: snapOut(effectiveBounds.west, "floor"),
                              east: snapOut(effectiveBounds.east, "ceil"),
                          }
                        : null;

                    const existing = zillowCacheRef.current.get(filterKey);
                    if (existing && fetchedBounds) {
                        const seen = new Set(existing.rows.map((r) => r.id));
                        const merged = [...existing.rows, ...rows.filter((r) => !seen.has(r.id))];
                        const unionBounds = {
                            south: Math.min(existing.coveredBounds.south, fetchedBounds.south),
                            north: Math.max(existing.coveredBounds.north, fetchedBounds.north),
                            west: Math.min(existing.coveredBounds.west, fetchedBounds.west),
                            east: Math.max(existing.coveredBounds.east, fetchedBounds.east),
                        };
                        zillowCacheRef.current.set(filterKey, { rows: merged, coveredBounds: unionBounds });
                        setAllZillowRows(merged);
                    } else {
                        if (fetchedBounds) {
                            zillowCacheRef.current.set(filterKey, { rows, coveredBounds: fetchedBounds });
                        }
                        setAllZillowRows(rows);
                    }
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
            mobileListingsPanel,
        });
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [filters, mapListingSource, showLatestOnly, areaType, areaFilter, mobileListingsPanel, router]);

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
    const snappedBoundsKey = useMemo(() => {
        const b = areaFilter?.bbox ?? mapBounds;
        if (!b) return null;
        return `${snapOut(b.south, "floor")},${snapOut(b.north, "ceil")},${snapOut(b.west, "floor")},${snapOut(b.east, "ceil")}`;
    }, [areaFilter, mapBounds]);

    // Zillow: re-fetch when non-spatial params or the snapped bbox tile changes,
    // but skip the fetch if the current viewport is already covered by cached data.
    useEffect(() => {
        if (mapListingSource !== "zillow") return;
        if (!snappedBoundsKey) return;
        const b = areaFilter?.bbox ?? mapBounds;
        if (!b) return;

        const filterKey = buildZillowFilterKey(areaFilter, filters, showLatestOnly);
        const cached = zillowCacheRef.current.get(filterKey);
        const snappedBounds = {
            south: snapOut(b.south, "floor"),
            north: snapOut(b.north, "ceil"),
            west: snapOut(b.west, "floor"),
            east: snapOut(b.east, "ceil"),
        };

        if (cached && boundsContainedIn(snappedBounds, cached.coveredBounds)) {
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

    const filtersPanel = (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Filters</h3>
                {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto px-2 py-1 text-xs">
                        Clear all
                    </Button>
                )}
            </div>
            <MapFiltersFields filters={filters} setFilters={setFilters} mapListingSource={mapListingSource} />
        </div>
    );

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Map controls — desktop */}
            <div className="hidden flex-shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:flex dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                    {(["zillow", "loopnet"] as const).map((source) => (
                        <button
                            key={source}
                            type="button"
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

                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                    {([true, false] as const).map((latest) => (
                        <button
                            key={String(latest)}
                            type="button"
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

                <MapAreaSearchSection
                    variant="toolbar"
                    areaType={areaType}
                    setAreaType={setAreaType}
                    areaFilter={areaFilter}
                    setAreaFilter={setAreaFilter}
                    areaInput={areaInput}
                    setAreaInput={setAreaInput}
                    areaSuggestions={areaSuggestions}
                    showSuggestions={showSuggestions}
                    setShowSuggestions={setShowSuggestions}
                    setAreaSuggestions={setAreaSuggestions}
                    inputWrapperRef={inputWrapperRef}
                    clearAreaFilter={clearAreaFilter}
                    commitZip={commitZip}
                    commitAddressText={commitAddressText}
                    selectSuggestion={selectSuggestion}
                />

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
                        {filtersPanel}
                    </PopoverContent>
                </Popover>
            </div>

            {/* Mobile: results + More menu */}
            <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 lg:hidden dark:border-gray-800 dark:bg-gray-900">
                <p className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
                    {loading ? "Loading…" : `${totalCount.toLocaleString()} results`}
                </p>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="More options">
                            <MoreVertical className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-[min(85vh,32rem)] w-[min(calc(100vw-2rem),22rem)] overflow-y-auto p-2">
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">More</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">Screen</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={mobileListingsPanel} onValueChange={(v) => setMobileListingsPanel(v as "list" | "map")}>
                            <DropdownMenuRadioItem value="list">List view</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="map">Map view</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">Listing type</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={mapListingSource} onValueChange={(v) => setMapListingSource(v as MapListingSource)}>
                            <DropdownMenuRadioItem value="zillow">Rent</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="loopnet">Sales</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">Time range</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={showLatestOnly ? "latest" : "historical"} onValueChange={(v) => setShowLatestOnly(v === "latest")}>
                            <DropdownMenuRadioItem value="latest">Latest</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="historical">Historical</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Area & search</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-[min(70vh,24rem)] w-[min(calc(100vw-2rem),20rem)] overflow-y-auto p-2">
                                <MapAreaSearchSection
                                    variant="menu"
                                    areaType={areaType}
                                    setAreaType={setAreaType}
                                    areaFilter={areaFilter}
                                    setAreaFilter={setAreaFilter}
                                    areaInput={areaInput}
                                    setAreaInput={setAreaInput}
                                    areaSuggestions={areaSuggestions}
                                    showSuggestions={showSuggestions}
                                    setShowSuggestions={setShowSuggestions}
                                    setAreaSuggestions={setAreaSuggestions}
                                    inputWrapperRef={inputWrapperRef}
                                    clearAreaFilter={clearAreaFilter}
                                    commitZip={commitZip}
                                    commitAddressText={commitAddressText}
                                    selectSuggestion={selectSuggestion}
                                />
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="relative">
                                Filters
                                {activeFilterCount > 0 && (
                                    <span className="ml-auto flex size-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-[min(70vh,24rem)] w-[min(calc(100vw-2rem),20rem)] overflow-y-auto p-3">
                                {filtersPanel}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Map content */}
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                <PropertiesSidebar
                    properties={properties}
                    selectedId={selectedId}
                    loading={loading}
                    totalCount={totalCount}
                    onSelect={setSelectedId}
                    className={cn(
                        mobileListingsPanel === "list" ? "flex min-h-0 flex-1" : "hidden",
                        "max-lg:h-full max-lg:min-h-0 max-lg:flex-1 max-lg:border-b-0 lg:flex",
                    )}
                />

                <div className={cn("relative min-h-0 flex-1", mobileListingsPanel === "map" ? "flex flex-col" : "hidden", "lg:flex")}>
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
