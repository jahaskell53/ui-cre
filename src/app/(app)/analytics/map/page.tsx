"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Search,
    Filter,
    Building2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyMap, type Property, type UnitMixRow, type MapBounds } from "@/components/application/map/property-map";
import { supabase } from "@/utils/supabase";
import { cn } from "@/lib/utils";

type MapListingSource = "loopnet" | "zillow";

interface Filters {
    priceMin: string;
    priceMax: string;
    capRateMin: string;
    capRateMax: string;
    sqftMin: string;
    sqftMax: string;
    beds: number[]; // empty = any; values: 0=Studio, 1,2,3,4+ (4 means >=4)
}

const defaultFilters: Filters = {
    priceMin: "",
    priceMax: "",
    capRateMin: "",
    capRateMax: "",
    sqftMin: "",
    sqftMax: "",
    beds: [],
};

const BED_OPTIONS = [
    { label: "Studio", value: 0 },
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4+", value: 4 },
];


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
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState<Filters>(defaultFilters);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [mapListingSource, setMapListingSource] = useState<MapListingSource>("zillow");
    const [showLatestOnly, setShowLatestOnly] = useState(true);
    const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
    const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.priceMin || filters.priceMax) count++;
        if (mapListingSource === 'loopnet' && (filters.capRateMin || filters.capRateMax)) count++;
        if (filters.sqftMin || filters.sqftMax) count++;
        if (mapListingSource === 'zillow' && filters.beds.length > 0) count++;
        return count;
    }, [filters]);

    const clearFilters = () => {
        setFilters(defaultFilters);
    };

    const fetchProperties = useCallback(async (search: string, currentFilters: Filters, source: MapListingSource, bounds: MapBounds | null, latestOnly: boolean) => {
        setLoading(true);

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
                // Build unit mix grouped by (beds, baths)
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
            if (search) {
                loopnetQuery = loopnetQuery.or(`headline.ilike.%${search}%,address.ilike.%${search}%,location.ilike.%${search}%`);
            }
            if (currentFilters.priceMin) {
                const minPrice = parseFloat(currentFilters.priceMin);
                if (!isNaN(minPrice)) loopnetQuery = loopnetQuery.gte('numeric_price', minPrice);
            }
            if (currentFilters.priceMax) {
                const maxPrice = parseFloat(currentFilters.priceMax);
                if (!isNaN(maxPrice)) loopnetQuery = loopnetQuery.lte('numeric_price', maxPrice);
            }
            if (currentFilters.capRateMin) {
                const minCapRate = parseFloat(currentFilters.capRateMin);
                if (!isNaN(minCapRate)) loopnetQuery = loopnetQuery.gte('numeric_cap_rate', minCapRate);
            }
            if (currentFilters.capRateMax) {
                const maxCapRate = parseFloat(currentFilters.capRateMax);
                if (!isNaN(maxCapRate)) loopnetQuery = loopnetQuery.lte('numeric_cap_rate', maxCapRate);
            }
            if (currentFilters.sqftMin) {
                const minSqft = parseFloat(currentFilters.sqftMin);
                if (!isNaN(minSqft)) loopnetQuery = loopnetQuery.gte('numeric_square_footage', minSqft);
            }
            if (currentFilters.sqftMax) {
                const maxSqft = parseFloat(currentFilters.sqftMax);
                if (!isNaN(maxSqft)) loopnetQuery = loopnetQuery.lte('numeric_square_footage', maxSqft);
            }
            if (bounds) {
                loopnetQuery = loopnetQuery
                    .gte('latitude', bounds.south).lte('latitude', bounds.north)
                    .gte('longitude', bounds.west).lte('longitude', bounds.east);
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
            if (search) {
                zillowQuery = zillowQuery.or(`address_raw.ilike.%${search}%,address_city.ilike.%${search}%,address_state.ilike.%${search}%`);
            }
            if (currentFilters.priceMin) {
                const minPrice = parseFloat(currentFilters.priceMin);
                if (!isNaN(minPrice)) zillowQuery = zillowQuery.gte('price', minPrice);
            }
            if (currentFilters.priceMax) {
                const maxPrice = parseFloat(currentFilters.priceMax);
                if (!isNaN(maxPrice)) zillowQuery = zillowQuery.lte('price', maxPrice);
            }
            if (currentFilters.sqftMin) {
                const minSqft = parseFloat(currentFilters.sqftMin);
                if (!isNaN(minSqft)) zillowQuery = zillowQuery.gte('area', minSqft);
            }
            if (currentFilters.sqftMax) {
                const maxSqft = parseFloat(currentFilters.sqftMax);
                if (!isNaN(maxSqft)) zillowQuery = zillowQuery.lte('area', maxSqft);
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
            if (bounds) {
                zillowQuery = zillowQuery
                    .gte('latitude', bounds.south).lte('latitude', bounds.north)
                    .gte('longitude', bounds.west).lte('longitude', bounds.east);
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
        if (!mapBounds) return;
        const timer = setTimeout(() => {
            fetchProperties(searchQuery, filters, mapListingSource, mapBounds, showLatestOnly);
        }, searchQuery ? 500 : 0);

        return () => clearTimeout(timer);
    }, [searchQuery, filters, mapListingSource, mapBounds, showLatestOnly, fetchProperties]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Map Controls Bar */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4 flex-shrink-0 bg-white dark:bg-gray-900 flex-wrap">
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

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                        placeholder="Search city, neighborhood..."
                        className="pl-9 h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                        }}
                    />
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
