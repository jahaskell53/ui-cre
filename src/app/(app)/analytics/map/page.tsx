"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Search,
    Filter,
    Building2,
    MapPin,
    X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyMap, type Property, type UnitMixRow, type MapBounds } from "@/components/application/map/property-map";
import { supabase } from "@/utils/supabase";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

type MapListingSource = "loopnet" | "zillow";
type AreaType = 'zip' | 'neighborhood' | 'city' | 'county' | 'msa' | 'address';

interface AreaFilter {
    type: AreaType;
    label: string;
    zipCode?: string;
    cityName?: string;
    cityState?: string;
    neighborhoodId?: number;
    countyName?: string;
    countyState?: string;
    msaGeoid?: string;
    addressQuery?: string;
    bbox?: MapBounds;
}

type AreaSuggestion =
    | { kind: 'neighborhood'; id: number; name: string; city: string; state: string }
    | { kind: 'mapbox'; feature: MapboxFeature }
    | { kind: 'msa'; id: number; geoid: string; name: string; name_lsad: string };

interface MapboxFeature {
    id: string;
    text: string;
    place_name: string;
    center: [number, number];
    bbox?: [number, number, number, number];
    context?: Array<{ id: string; text: string; short_code?: string }>;
}

interface Filters {
    priceMin: string;
    priceMax: string;
    capRateMin: string;
    capRateMax: string;
    sqftMin: string;
    sqftMax: string;
    beds: number[];
    propertyType: 'both' | 'reit' | 'mid-market';
}

const defaultFilters: Filters = {
    priceMin: "",
    priceMax: "",
    capRateMin: "",
    capRateMax: "",
    sqftMin: "",
    sqftMax: "",
    beds: [],
    propertyType: 'both',
};

const BED_OPTIONS = [
    { label: "Studio", value: 0 },
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4+", value: 4 },
];

const AREA_TYPE_LABELS: Record<AreaType, string> = {
    zip: 'ZIP',
    neighborhood: 'Neighborhood',
    city: 'City',
    county: 'County',
    msa: 'MSA',
    address: 'Address',
};

const AREA_TYPE_PLACEHOLDERS: Record<AreaType, string> = {
    zip: 'Enter zip code…',
    neighborhood: 'Search neighborhood…',
    city: 'Search city…',
    county: 'Search county…',
    msa: 'Search metro area…',
    address: 'Search address, building name…',
};

function PropertiesListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-3">
                    <div className="flex gap-3">
                        <div className="w-16 h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="flex-1">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2 mt-2" />
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3 mt-2" />
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
        const lat = parseFloat(searchParams.get('lat') ?? '');
        const lng = parseFloat(searchParams.get('lng') ?? '');
        return isNaN(lat) || isNaN(lng) ? undefined : [lng, lat];
    }, []);
    const initialZoom = useMemo<number | undefined>(() => {
        const z = parseFloat(searchParams.get('zoom') ?? '');
        return isNaN(z) ? undefined : z;
    }, []);

    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [filters, setFilters] = useState<Filters>(defaultFilters);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [mapListingSource, setMapListingSource] = useState<MapListingSource>("zillow");
    const [showLatestOnly, setShowLatestOnly] = useState(true);
    const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
    const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Area-type search state
    const [areaType, setAreaType] = useState<AreaType>('zip');
    const [areaFilter, setAreaFilter] = useState<AreaFilter | null>(null);
    const [areaInput, setAreaInput] = useState('');
    const [areaSuggestions, setAreaSuggestions] = useState<AreaSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [fitBoundsTarget, setFitBoundsTarget] = useState<MapBounds | null>(null);
    const [boundaryGeoJSON, setBoundaryGeoJSON] = useState<string | null>(null);
    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.priceMin || filters.priceMax) count++;
        if (mapListingSource === 'loopnet' && (filters.capRateMin || filters.capRateMax)) count++;
        if (filters.sqftMin || filters.sqftMax) count++;
        if (mapListingSource === 'zillow' && filters.beds.length > 0) count++;
        if (mapListingSource === 'zillow' && filters.propertyType !== 'both') count++;
        return count;
    }, [filters, mapListingSource]);

    const clearFilters = () => { setFilters(defaultFilters); };

    const clearAreaFilter = () => {
        setAreaFilter(null);
        setAreaInput('');
        setAreaSuggestions([]);
        setBoundaryGeoJSON(null);
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };

    // Autocomplete suggestions based on area type
    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);

        // Address type: debounce the filter directly, no dropdown suggestions
        if (areaType === 'address') {
            const q = areaInput.trim();
            // Bail if the filter already matches — prevents infinite re-render loop
            if ((q && areaFilter?.addressQuery === q) || (!q && !areaFilter)) return;
            suggestTimerRef.current = setTimeout(() => {
                setAreaFilter(q ? { type: 'address', label: q, addressQuery: q } : null);
            }, 500);
            return;
        }

        if (areaFilter || areaInput.length < 2 || areaType === 'zip') {
            setAreaSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        suggestTimerRef.current = setTimeout(async () => {
            if (areaType === 'neighborhood') {
                const { data } = await supabase.rpc('search_neighborhoods', { p_query: areaInput });
                setAreaSuggestions(((data ?? []) as { id: number; name: string; city: string; state: string }[]).map(r => ({ kind: 'neighborhood' as const, ...r })));
                setShowSuggestions(true);
            } else if (areaType === 'msa') {
                const { data } = await supabase.rpc('search_msas', { p_query: areaInput });
                setAreaSuggestions(((data ?? []) as { id: number; geoid: string; name: string; name_lsad: string }[]).map(r => ({ kind: 'msa' as const, ...r })));
                setShowSuggestions(true);
            } else {
                const mapboxType = areaType === 'city' ? 'place' : 'district';
                try {
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(areaInput)}.json?access_token=${MAPBOX_TOKEN}&types=${mapboxType}&country=US&limit=6`
                    );
                    const json = await res.json();
                    setAreaSuggestions(((json.features ?? []) as MapboxFeature[]).map(f => ({ kind: 'mapbox' as const, feature: f })));
                    setShowSuggestions(true);
                } catch { setAreaSuggestions([]); }
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
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const commitZip = async (zip: string) => {
        const v = zip.trim();
        if (!v) return;
        setAreaFilter({ type: 'zip', label: v, zipCode: v });
        setShowSuggestions(false);
        const { data } = await supabase.rpc('get_zip_boundary', { p_zip: v });
        if (data) setBoundaryGeoJSON(data as string);
    };

    const selectSuggestion = async (s: AreaSuggestion) => {
        setShowSuggestions(false);
        setAreaSuggestions([]);

        if (s.kind === 'neighborhood') {
            const [bboxRes, geojsonRes] = await Promise.all([
                supabase.rpc('get_neighborhood_bbox', { p_neighborhood_id: s.id }),
                supabase.rpc('get_neighborhood_geojson', { p_id: s.id }),
            ]);
            const row = (bboxRes.data as { west: number; south: number; east: number; north: number }[] | null)?.[0];
            const bbox: MapBounds | undefined = row ? { west: row.west, south: row.south, east: row.east, north: row.north } : undefined;
            const label = `${s.name} · ${s.city}`;
            setAreaInput(label);
            setAreaFilter({ type: 'neighborhood', label, neighborhoodId: s.id, bbox });
            if (bbox) setFitBoundsTarget(bbox);
            if (geojsonRes.data) setBoundaryGeoJSON(geojsonRes.data as string);
        } else if (s.kind === 'msa') {
            const [bboxRes, geojsonRes] = await Promise.all([
                supabase.rpc('get_msa_bbox', { p_geoid: s.geoid }),
                supabase.rpc('get_msa_geojson', { p_geoid: s.geoid }),
            ]);
            const row = (bboxRes.data as { west: number; south: number; east: number; north: number }[] | null)?.[0];
            const bbox: MapBounds | undefined = row ? { west: row.west, south: row.south, east: row.east, north: row.north } : undefined;
            const label = s.name_lsad || s.name;
            setAreaInput(label);
            setAreaFilter({ type: 'msa', label, msaGeoid: s.geoid, bbox });
            if (bbox) setFitBoundsTarget(bbox);
            if (geojsonRes.data) setBoundaryGeoJSON(geojsonRes.data as string);
        } else {
            const feature = s.feature;
            const regionCtx = feature.context?.find(c => c.id.startsWith('region.'));
            const stateCode = regionCtx?.short_code?.replace('US-', '') ?? '';
            const mb = feature.bbox;
            const bbox: MapBounds | undefined = mb ? { west: mb[0], south: mb[1], east: mb[2], north: mb[3] } : undefined;
            if (areaType === 'city') {
                const label = stateCode ? `${feature.text}, ${stateCode}` : feature.text;
                setAreaInput(label);
                setAreaFilter({ type: 'city', label, cityName: feature.text, cityState: stateCode, bbox });
                if (bbox) setFitBoundsTarget(bbox);
                const { data } = await supabase.rpc('get_city_geojson', { p_name: feature.text, p_state: stateCode });
                if (data) setBoundaryGeoJSON(data as string);
            } else {
                // county
                const label = stateCode ? `${feature.text}, ${stateCode}` : feature.text;
                setAreaInput(label);
                setAreaFilter({ type: 'county', label, countyName: feature.text, countyState: stateCode, bbox });
                if (bbox) setFitBoundsTarget(bbox);
                const { data } = await supabase.rpc('get_county_geojson', { p_name: feature.text, p_state: stateCode });
                if (data) setBoundaryGeoJSON(data as string);
            }
        }
    };

    const fetchProperties = useCallback(async (activeAreaFilter: AreaFilter | null, currentFilters: Filters, source: MapListingSource, bounds: MapBounds | null, latestOnly: boolean) => {
        setLoading(true);

        // Which bounds to use for geographic clipping
        const effectiveBounds = activeAreaFilter?.bbox ?? bounds;

        type RowWithDate = Property & { _createdAt?: string };
        const mapLoopnet = (item: Record<string, unknown>): RowWithDate => ({
            id: item.id as string | number,
            name: (item.headline || item.address || 'Building') as string,
            address: (item.address || 'Address not listed') as string,
            location: (item.location as string) ?? undefined,
            units: item.square_footage ? (Math.floor(parseInt(String(item.square_footage).replace(/[^0-9]/g, '') || '0') / 500) || null) : null,
            price: (item.price as string) || 'TBD',
            coordinates: [item.longitude as number, item.latitude as number],
            thumbnailUrl: (item.thumbnail_url as string | null) ?? undefined,
            capRate: (item.cap_rate as string | null) ?? undefined,
            squareFootage: (item.square_footage as string) ?? undefined,
            listingSource: 'loopnet',
            _createdAt: (item.created_at as string) ?? '',
        });

        const mapCleanedListing = (item: Record<string, unknown>): RowWithDate => {
            const city = (item.address_city as string) || '';
            const fullAddress = (item.address_raw as string) ||
                [item.address_street, city, item.address_state, item.address_zip].filter(Boolean).join(', ') ||
                'Address not listed';
            const priceVal = item.price as number | null;
            return {
                id: `zillow-${item.id as string}`,
                name: fullAddress,
                address: fullAddress,
                location: city || undefined,
                units: null,
                price: priceVal ? `$${priceVal.toLocaleString()}` : 'TBD',
                coordinates: [item.longitude as number, item.latitude as number],
                thumbnailUrl: (item.img_src as string | null) ?? undefined,
                capRate: undefined,
                squareFootage: item.area ? String(item.area) : undefined,
                listingSource: 'zillow',
                _createdAt: (item.scraped_at as string) ?? '',
            };
        };

        const groupReitRows = (reitRows: Record<string, unknown>[]): RowWithDate[] => {
            const byBuilding: Record<string, Record<string, unknown>[]> = {};
            for (const row of reitRows) {
                const bz = row.building_zpid as string;
                if (!byBuilding[bz]) byBuilding[bz] = [];
                byBuilding[bz].push(row);
            }
            return Object.entries(byBuilding).map(([, units]) => {
                const first = units[0];
                const city = (first.address_city as string) || '';
                const fullAddress = (first.address_raw as string) ||
                    [first.address_street, city, first.address_state, first.address_zip].filter(Boolean).join(', ') ||
                    'Address not listed';
                const mixMap: Record<string, { beds: number | null; baths: number | null; count: number; totalPrice: number; validPriceCount: number }> = {};
                for (const unit of units) {
                    const key = `${(unit.beds ?? 0)}-${unit.baths ?? 'null'}`;
                    if (!mixMap[key]) {
                        mixMap[key] = { beds: (unit.beds as number | null) ?? 0, baths: unit.baths as number | null, count: 0, totalPrice: 0, validPriceCount: 0 };
                    }
                    mixMap[key].count++;
                    if (unit.price) {
                        mixMap[key].totalPrice += unit.price as number;
                        mixMap[key].validPriceCount++;
                    }
                }
                const unitMix: UnitMixRow[] = Object.values(mixMap)
                    .sort((a, b) => (a.beds ?? 0) - (b.beds ?? 0) || (a.baths ?? 0) - (b.baths ?? 0))
                    .map(({ beds, baths, count, totalPrice, validPriceCount }) => ({
                        beds,
                        baths,
                        count,
                        avgPrice: validPriceCount > 0 ? Math.round(totalPrice / validPriceCount) : null,
                    }));
                const prices = units.map(u => u.price as number | null).filter((p): p is number => p != null);
                const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
                return {
                    id: `zillow-${first.id as string}`,
                    name: fullAddress,
                    address: fullAddress,
                    location: city || undefined,
                    units: units.length,
                    price: avgPrice ? `$${avgPrice.toLocaleString()} avg` : 'TBD',
                    coordinates: [first.longitude as number, first.latitude as number],
                    thumbnailUrl: (first.img_src as string | null) ?? undefined,
                    capRate: undefined,
                    squareFootage: undefined,
                    listingSource: 'zillow' as const,
                    isReit: true,
                    unitMix,
                    _createdAt: (first.scraped_at as string) ?? '',
                };
            });
        };

        const processZillowData = (data: Record<string, unknown>[]): RowWithDate[] => {
            const nonReit = data.filter(r => !r.building_zpid && !r.is_building);
            const reitUnits = data.filter(r => r.building_zpid != null);
            return [...nonReit.map(mapCleanedListing), ...groupReitRows(reitUnits)];
        };

        if (source === 'loopnet') {
            const { data: latestRun } = await supabase
                .from('loopnet_listings')
                .select('run_id')
                .order('run_id', { ascending: false })
                .limit(1)
                .single();
            let loopnetQuery = supabase
                .from('loopnet_listings')
                .select('*', { count: 'exact' })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .order('created_at', { ascending: false });
            if (latestOnly && latestRun?.run_id != null) {
                loopnetQuery = loopnetQuery.eq('run_id', latestRun.run_id);
            }
            // Area filter
            if (activeAreaFilter?.zipCode) {
                loopnetQuery = loopnetQuery.or(`address.ilike.%${activeAreaFilter.zipCode}%,location.ilike.%${activeAreaFilter.zipCode}%`);
            } else if (activeAreaFilter?.cityName) {
                loopnetQuery = loopnetQuery.ilike('location', `%${activeAreaFilter.cityName}%`);
            } else if (activeAreaFilter?.countyName) {
                loopnetQuery = loopnetQuery.or(`address.ilike.%${activeAreaFilter.countyName}%,location.ilike.%${activeAreaFilter.countyName}%`);
            } else if (activeAreaFilter?.addressQuery) {
                loopnetQuery = loopnetQuery.or(`headline.ilike.%${activeAreaFilter.addressQuery}%,address.ilike.%${activeAreaFilter.addressQuery}%,location.ilike.%${activeAreaFilter.addressQuery}%`);
            }
            // Price / cap-rate / sqft filters
            if (currentFilters.priceMin) {
                const v = parseFloat(currentFilters.priceMin);
                if (!isNaN(v)) loopnetQuery = loopnetQuery.gte('numeric_price', v);
            }
            if (currentFilters.priceMax) {
                const v = parseFloat(currentFilters.priceMax);
                if (!isNaN(v)) loopnetQuery = loopnetQuery.lte('numeric_price', v);
            }
            if (currentFilters.capRateMin) {
                const v = parseFloat(currentFilters.capRateMin);
                if (!isNaN(v)) loopnetQuery = loopnetQuery.gte('numeric_cap_rate', v);
            }
            if (currentFilters.capRateMax) {
                const v = parseFloat(currentFilters.capRateMax);
                if (!isNaN(v)) loopnetQuery = loopnetQuery.lte('numeric_cap_rate', v);
            }
            if (currentFilters.sqftMin) {
                const v = parseFloat(currentFilters.sqftMin);
                if (!isNaN(v)) loopnetQuery = loopnetQuery.gte('numeric_square_footage', v);
            }
            if (currentFilters.sqftMax) {
                const v = parseFloat(currentFilters.sqftMax);
                if (!isNaN(v)) loopnetQuery = loopnetQuery.lte('numeric_square_footage', v);
            }
            if (effectiveBounds) {
                loopnetQuery = loopnetQuery
                    .gte('latitude', effectiveBounds.south).lte('latitude', effectiveBounds.north)
                    .gte('longitude', effectiveBounds.west).lte('longitude', effectiveBounds.east);
            }
            const { data, error, count } = await loopnetQuery;
            if (error) console.error('Error fetching loopnet listings:', error);
            const rows = (data ?? []).map((item) => mapLoopnet(item as Record<string, unknown>));
            setProperties(rows.map(({ _createdAt: _, ...p }) => p));
            setTotalCount(count ?? 0);
            setLoading(false);
            return;
        }

        if (source === 'zillow') {
            const { data: latestZillowRun } = await supabase
                .from('cleaned_listings')
                .select('run_id')
                .order('run_id', { ascending: false })
                .limit(1)
                .single();
            let zillowQuery = supabase
                .from('cleaned_listings')
                .select('*', { count: 'exact' })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .not('is_sfr', 'is', true)
                .order('scraped_at', { ascending: false });
            if (latestOnly && latestZillowRun?.run_id != null) {
                zillowQuery = zillowQuery.eq('run_id', latestZillowRun.run_id);
            }
            // Area filter
            if (activeAreaFilter?.zipCode) {
                zillowQuery = zillowQuery.eq('address_zip', activeAreaFilter.zipCode);
            } else if (activeAreaFilter?.cityName) {
                zillowQuery = zillowQuery.ilike('address_city', `%${activeAreaFilter.cityName}%`);
            } else if (activeAreaFilter?.addressQuery) {
                zillowQuery = zillowQuery.or(`address_raw.ilike.%${activeAreaFilter.addressQuery}%,address_city.ilike.%${activeAreaFilter.addressQuery}%,address_state.ilike.%${activeAreaFilter.addressQuery}%`);
            } else if (activeAreaFilter?.countyName) {
                // No dedicated county column — fall through to bbox filtering below
            }
            // Price / sqft / beds / property-type filters
            if (currentFilters.priceMin) {
                const v = parseFloat(currentFilters.priceMin);
                if (!isNaN(v)) zillowQuery = zillowQuery.gte('price', v);
            }
            if (currentFilters.priceMax) {
                const v = parseFloat(currentFilters.priceMax);
                if (!isNaN(v)) zillowQuery = zillowQuery.lte('price', v);
            }
            if (currentFilters.sqftMin) {
                const v = parseFloat(currentFilters.sqftMin);
                if (!isNaN(v)) zillowQuery = zillowQuery.gte('area', v);
            }
            if (currentFilters.sqftMax) {
                const v = parseFloat(currentFilters.sqftMax);
                if (!isNaN(v)) zillowQuery = zillowQuery.lte('area', v);
            }
            if (currentFilters.beds.length > 0) {
                const exact = currentFilters.beds.filter(b => b < 4);
                const hasPlus = currentFilters.beds.includes(4);
                if (exact.length > 0 && hasPlus) {
                    zillowQuery = zillowQuery.or(`beds.in.(${exact.join(',')}),beds.gte.4`);
                } else if (hasPlus) {
                    zillowQuery = zillowQuery.gte('beds', 4);
                } else {
                    zillowQuery = zillowQuery.in('beds', exact);
                }
            }
            if (currentFilters.propertyType === 'reit') {
                zillowQuery = zillowQuery.or('is_building.eq.true,building_zpid.not.is.null');
            } else if (currentFilters.propertyType === 'mid-market') {
                zillowQuery = zillowQuery.is('building_zpid', null).not('is_building', 'eq', true);
            }
            if (effectiveBounds) {
                zillowQuery = zillowQuery
                    .gte('latitude', effectiveBounds.south).lte('latitude', effectiveBounds.north)
                    .gte('longitude', effectiveBounds.west).lte('longitude', effectiveBounds.east);
            }
            const { data, error, count } = await zillowQuery;
            if (error) console.error('Error fetching cleaned listings:', error);
            const rows = processZillowData((data ?? []) as Record<string, unknown>[]);
            setProperties(rows.map(({ _createdAt: _, ...p }) => p));
            setTotalCount(count ?? 0);
            setLoading(false);
            return;
        }

        setLoading(false);
    }, []);

    const handleBoundsChange = useCallback((bounds: MapBounds) => {
        if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
        boundsTimerRef.current = setTimeout(() => {
            setMapBounds(bounds);
        }, 300);
    }, []);

    const handleViewChange = useCallback((lat: number, lng: number, zoom: number) => {
        const params = new URLSearchParams(window.location.search);
        params.set('lat', lat.toFixed(5));
        params.set('lng', lng.toFixed(5));
        params.set('zoom', zoom.toFixed(2));
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [router]);

    useEffect(() => {
        if (!areaFilter && !mapBounds) return;
        fetchProperties(areaFilter, filters, mapListingSource, areaFilter ? null : mapBounds, showLatestOnly);
    }, [areaFilter, filters, mapListingSource, mapBounds, showLatestOnly, fetchProperties]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Map Controls Bar */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 flex-shrink-0 bg-white dark:bg-gray-900 flex-wrap">
                {/* Sales vs Rent toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {(["zillow", "loopnet"] as const).map((source) => (
                        <button
                            key={source}
                            onClick={() => { setMapListingSource(source); }}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                                mapListingSource === source
                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400"
                            )}
                        >
                            {source === "loopnet" ? "Sales" : "Rent"}
                        </button>
                    ))}
                </div>

                {/* Latest / Historical toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {([true, false] as const).map((latest) => (
                        <button
                            key={String(latest)}
                            onClick={() => setShowLatestOnly(latest)}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                                showLatestOnly === latest
                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400"
                            )}
                        >
                            {latest ? "Latest" : "Historical"}
                        </button>
                    ))}
                </div>

                {/* Area type selector + search */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Area type buttons */}
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs flex-shrink-0">
                        {(Object.keys(AREA_TYPE_LABELS) as AreaType[]).map((type, i) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => {
                                    setAreaType(type);
                                    setAreaFilter(null);
                                    setAreaInput('');
                                    setAreaSuggestions([]);
                                }}
                                className={cn(
                                    "px-2.5 py-1.5 font-medium transition-colors whitespace-nowrap",
                                    i > 0 && "border-l border-gray-200 dark:border-gray-600",
                                    areaType === type
                                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                                )}
                            >
                                {AREA_TYPE_LABELS[type]}
                            </button>
                        ))}
                    </div>

                    {/* Search input or committed area chip */}
                    {areaFilter && areaFilter.type !== 'address' ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-md text-xs text-blue-700 dark:text-blue-300 flex-shrink-0">
                            <MapPin className="size-3 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">{areaFilter.label}</span>
                            <button
                                type="button"
                                onClick={clearAreaFilter}
                                className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="relative flex-1 max-w-xs" ref={inputWrapperRef}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                            <Input
                                inputMode={areaType === 'zip' ? 'numeric' : 'text'}
                                placeholder={AREA_TYPE_PLACEHOLDERS[areaType]}
                                className={cn("pl-9 h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700", areaType === 'address' && areaInput && "pr-8")}
                                value={areaInput}
                                onChange={(e) => setAreaInput(e.target.value)}
                                onFocus={() => { if (areaSuggestions.length > 0) setShowSuggestions(true); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && areaType === 'zip') {
                                        commitZip(areaInput);
                                    } else if (e.key === 'Escape') {
                                        setShowSuggestions(false);
                                    }
                                }}
                            />
                            {areaType === 'address' && areaInput && (
                                <button
                                    type="button"
                                    onClick={clearAreaFilter}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                            {showSuggestions && areaSuggestions.length > 0 && (
                                <ul className="absolute top-full mt-1 left-0 right-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                                    {areaSuggestions.map((s, i) => {
                                        const label = s.kind === 'neighborhood'
                                            ? `${s.name} · ${s.city}, ${s.state}`
                                            : s.kind === 'msa'
                                            ? (s.name_lsad || s.name)
                                            : s.feature.place_name;
                                        return (
                                            <li
                                                key={i}
                                                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                                            >
                                                <MapPin className="size-3 text-gray-400 flex-shrink-0" />
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
                        <Button variant="outline" size="sm" className="h-8 relative">
                            <Filter className="size-3.5" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 size-4 rounded-full bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-sm">Filters</h3>
                                {activeFilterCount > 0 && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto px-2 py-1 text-xs">
                                        Clear all
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-3">
                                {mapListingSource === 'zillow' && (
                                    <div>
                                        <Label className="text-xs">Bedrooms</Label>
                                        <div className="flex gap-1.5 mt-1 flex-wrap">
                                            {BED_OPTIONS.map(({ label, value }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setFilters(prev => ({
                                                        ...prev,
                                                        beds: prev.beds.includes(value)
                                                            ? prev.beds.filter(b => b !== value)
                                                            : [...prev.beds, value],
                                                    }))}
                                                    className={cn(
                                                        "px-2.5 py-1 text-xs rounded-md border transition-colors",
                                                        filters.beds.includes(value)
                                                            ? "bg-blue-600 text-white border-blue-600"
                                                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {mapListingSource === 'zillow' && (
                                    <div>
                                        <Label className="text-xs">Property Type</Label>
                                        <div className="flex gap-1.5 mt-1">
                                            {([['both', 'Both'], ['reit', 'REIT'], ['mid-market', 'Mid-market']] as const).map(([value, label]) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setFilters(prev => ({ ...prev, propertyType: value }))}
                                                    className={cn(
                                                        "px-2.5 py-1 text-xs rounded-md border transition-colors",
                                                        filters.propertyType === value
                                                            ? "bg-blue-600 text-white border-blue-600"
                                                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700"
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
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            type="number"
                                            placeholder="Min"
                                            value={filters.priceMin}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, priceMin: e.target.value })); }}
                                            className="h-7 text-xs"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Max"
                                            value={filters.priceMax}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, priceMax: e.target.value })); }}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                                {mapListingSource === 'loopnet' && (
                                    <div>
                                        <Label className="text-xs">Cap Rate (%)</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                type="number"
                                                placeholder="Min"
                                                value={filters.capRateMin}
                                                onChange={(e) => { setFilters(prev => ({ ...prev, capRateMin: e.target.value })); }}
                                                className="h-7 text-xs"
                                            />
                                            <Input
                                                type="number"
                                                placeholder="Max"
                                                value={filters.capRateMax}
                                                onChange={(e) => { setFilters(prev => ({ ...prev, capRateMax: e.target.value })); }}
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
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                {/* Sidebar */}
                <div className="w-full lg:w-72 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 z-10">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {loading ? 'Loading...' : `${totalCount.toLocaleString()} Results`}
                        </span>
                    </div>

                    <div className="flex-1 overflow-auto divide-y divide-gray-200 dark:divide-gray-800">
                        {loading ? (
                            <PropertiesListSkeleton count={4} />
                        ) : properties.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                                No properties found
                            </div>
                        ) : (
                            properties.map((property) => (
                                <div
                                    key={property.id}
                                    onClick={() => setSelectedId(property.id)}
                                    className={cn(
                                        "p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors",
                                        selectedId === property.id && "bg-gray-50 dark:bg-gray-800"
                                    )}
                                >
                                    <Link href={`/analytics/listing/${property.id}`} className="flex gap-3 group" onClick={(e) => e.stopPropagation()}>
                                        <div className="w-16 h-12 bg-gray-100 dark:bg-gray-800 rounded flex-shrink-0 overflow-hidden">
                                            {property.thumbnailUrl ? (
                                                <img src={property.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Building2 className="size-4 text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                                <h4 className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-1">
                                                    {property.name}
                                                </h4>
                                                {property.isReit && (
                                                    <span className="text-[8px] font-bold px-1 py-0.5 bg-violet-100 text-violet-700 rounded flex-shrink-0">REIT</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-500 truncate">{property.address}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                                    {property.price}
                                                </span>
                                                {property.isReit && property.units && (
                                                    <span className="text-[10px] text-gray-500">{property.units} units</span>
                                                )}
                                                {property.capRate && (
                                                    <span className="text-[10px] text-gray-500">{property.capRate}</span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>

                </div>

                {/* Map */}
                <div className="flex-1 relative">
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
