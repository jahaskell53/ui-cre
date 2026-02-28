"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
    Search,
    Filter,
    TrendingUp,
    Map,
    BarChart3,
    Building2,
    Layers,
    DollarSign,
    Home,
    Activity,
    ShoppingCart,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyMap, type Property, type HeatmapMetric, type MapBounds } from "@/components/application/map/property-map";
import { PaginationButtonGroup } from "@/components/application/pagination/pagination";
import { supabase } from "@/utils/supabase";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 200;

type MapListingSource = "all" | "loopnet" | "zillow";

interface Filters {
    priceMin: string;
    priceMax: string;
    capRateMin: string;
    capRateMax: string;
    sqftMin: string;
    sqftMax: string;
}

const defaultFilters: Filters = {
    priceMin: "",
    priceMax: "",
    capRateMin: "",
    capRateMax: "",
    sqftMin: "",
    sqftMax: "",
};

const heatmapOptions: { value: HeatmapMetric; label: string; icon: React.ElementType; description?: string }[] = [
    { value: 'none', label: 'None', icon: Layers, description: 'Show markers only' },
    { value: 'neighborhood', label: 'Neighborhoods', icon: Map, description: 'Filter by area' },
    { value: 'capRate', label: 'Cap Rate', icon: TrendingUp, description: 'Heatmap by cap rate' },
    { value: 'rent', label: 'Avg Rent', icon: Home, description: 'Heatmap by rent levels' },
    { value: 'valuation', label: 'Valuation', icon: DollarSign, description: 'Heatmap by property value' },
    { value: 'recentSales', label: 'Recent Sales', icon: ShoppingCart, description: 'Heatmap by sales activity' },
    { value: 'trending', label: 'Trending', icon: Activity, description: 'Heatmap by appreciation' },
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

export default function MapPage() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState<Filters>(defaultFilters);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [mapListingSource, setMapListingSource] = useState<MapListingSource>("all");
    const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
    const [mapFilter, setMapFilter] = useState<"all" | "owned">("all");
    const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('none');
    const [layersOpen, setLayersOpen] = useState(false);
    const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.priceMin || filters.priceMax) count++;
        if (filters.capRateMin || filters.capRateMax) count++;
        if (filters.sqftMin || filters.sqftMax) count++;
        return count;
    }, [filters]);

    const clearFilters = () => {
        setFilters(defaultFilters);
        setPage(0);
    };

    const fetchProperties = useCallback(async (pageNum: number, search: string, currentFilters: Filters, source: MapListingSource, bounds: MapBounds | null) => {
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

        if (source === 'loopnet') {
            let loopnetQuery = supabase
                .from('loopnet_listings')
                .select('*', { count: 'exact' })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .order('created_at', { ascending: false });
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
            const { data, error, count } = await loopnetQuery.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
            if (error) console.error('Error fetching loopnet listings:', error);
            const rows = (data ?? []).map((item) => mapLoopnet(item as Record<string, unknown>));
            setProperties(rows.map(({ _createdAt: _, ...p }) => p));
            setTotalCount(count ?? 0);
            setLoading(false);
            return;
        }

        if (source === 'zillow') {
            let zillowQuery = supabase
                .from('cleaned_listings')
                .select('*', { count: 'exact' })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .not('is_sfr', 'is', true)
                .order('scraped_at', { ascending: false });
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
            if (bounds) {
                zillowQuery = zillowQuery
                    .gte('latitude', bounds.south).lte('latitude', bounds.north)
                    .gte('longitude', bounds.west).lte('longitude', bounds.east);
            }
            const { data, error, count } = await zillowQuery.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
            if (error) console.error('Error fetching cleaned listings:', error);
            const rows = (data ?? []).map((item) => mapCleanedListing(item as Record<string, unknown>));
            setProperties(rows.map(({ _createdAt: _, ...p }) => p));
            setTotalCount(count ?? 0);
            setLoading(false);
            return;
        }

        // source === 'all': fetch both in parallel
        let loopnetQuery = supabase
            .from('loopnet_listings')
            .select('*', { count: 'exact' })
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('created_at', { ascending: false });
        let zillowQuery = supabase
            .from('cleaned_listings')
            .select('*', { count: 'exact' })
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .not('is_sfr', 'is', true)
            .order('scraped_at', { ascending: false });

        if (search) {
            loopnetQuery = loopnetQuery.or(`headline.ilike.%${search}%,address.ilike.%${search}%,location.ilike.%${search}%`);
            zillowQuery = zillowQuery.or(`address_raw.ilike.%${search}%,address_city.ilike.%${search}%,address_state.ilike.%${search}%`);
        }
        if (currentFilters.priceMin) {
            const minPrice = parseFloat(currentFilters.priceMin);
            if (!isNaN(minPrice)) {
                loopnetQuery = loopnetQuery.gte('numeric_price', minPrice);
                zillowQuery = zillowQuery.gte('price', minPrice);
            }
        }
        if (currentFilters.priceMax) {
            const maxPrice = parseFloat(currentFilters.priceMax);
            if (!isNaN(maxPrice)) {
                loopnetQuery = loopnetQuery.lte('numeric_price', maxPrice);
                zillowQuery = zillowQuery.lte('price', maxPrice);
            }
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
            if (!isNaN(minSqft)) {
                loopnetQuery = loopnetQuery.gte('numeric_square_footage', minSqft);
                zillowQuery = zillowQuery.gte('area', minSqft);
            }
        }
        if (currentFilters.sqftMax) {
            const maxSqft = parseFloat(currentFilters.sqftMax);
            if (!isNaN(maxSqft)) {
                loopnetQuery = loopnetQuery.lte('numeric_square_footage', maxSqft);
                zillowQuery = zillowQuery.lte('area', maxSqft);
            }
        }
        if (bounds) {
            loopnetQuery = loopnetQuery
                .gte('latitude', bounds.south).lte('latitude', bounds.north)
                .gte('longitude', bounds.west).lte('longitude', bounds.east);
            zillowQuery = zillowQuery
                .gte('latitude', bounds.south).lte('latitude', bounds.north)
                .gte('longitude', bounds.west).lte('longitude', bounds.east);
        }

        const [loopnetRes, zillowRes] = await Promise.all([
            loopnetQuery.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1),
            zillowQuery.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1),
        ]);

        if (loopnetRes.error) console.error('Error fetching loopnet listings:', loopnetRes.error);
        if (zillowRes.error) console.error('Error fetching cleaned listings:', zillowRes.error);

        const loopnetRows = (loopnetRes.data ?? []).map((item) => mapLoopnet(item as Record<string, unknown>))
            .sort((a, b) => (b._createdAt || '').localeCompare(a._createdAt || ''));
        const zillowRows = (zillowRes.data ?? []).map((item) => mapCleanedListing(item as Record<string, unknown>))
            .sort((a, b) => (b._createdAt || '').localeCompare(a._createdAt || ''));
        const merged = [...loopnetRows, ...zillowRows].sort((a, b) => (b._createdAt || '').localeCompare(a._createdAt || ''));
        setProperties(merged.map(({ _createdAt: _, ...p }) => p));
        setTotalCount((loopnetRes.count ?? 0) + (zillowRes.count ?? 0));

        setLoading(false);
    }, []);

    const handleBoundsChange = useCallback((bounds: MapBounds) => {
        if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
        boundsTimerRef.current = setTimeout(() => {
            setPage(0);
            setMapBounds(bounds);
        }, 300);
    }, []);

    useEffect(() => {
        if (!mapBounds) return;
        const timer = setTimeout(() => {
            fetchProperties(page, searchQuery, filters, mapListingSource, mapBounds);
        }, searchQuery ? 500 : 0);

        return () => clearTimeout(timer);
    }, [page, searchQuery, filters, mapListingSource, mapBounds, fetchProperties]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const handlePageChange = (newPage: number) => {
        setPage(newPage - 1);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Map Controls Bar */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4 flex-shrink-0 bg-white dark:bg-gray-900 flex-wrap">
                {/* Sales vs Rent toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {(["loopnet", "zillow", "all"] as const).map((source) => (
                        <button
                            key={source}
                            onClick={() => { setMapListingSource(source); setPage(0); }}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                                mapListingSource === source
                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400"
                            )}
                        >
                            {source === "all" ? "All" : source === "loopnet" ? "Sales" : "Rent"}
                        </button>
                    ))}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {(["all", "owned"] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setMapFilter(filter)}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                                mapFilter === filter
                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400"
                            )}
                        >
                            {filter === "all" ? "All" : filter}
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
                            setPage(0);
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
                                <div>
                                    <Label className="text-xs">Price Range</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            type="number"
                                            placeholder="Min"
                                            value={filters.priceMin}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, priceMin: e.target.value })); setPage(0); }}
                                            className="h-7 text-xs"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Max"
                                            value={filters.priceMax}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, priceMax: e.target.value })); setPage(0); }}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">Cap Rate (%)</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            type="number"
                                            placeholder="Min"
                                            value={filters.capRateMin}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, capRateMin: e.target.value })); setPage(0); }}
                                            className="h-7 text-xs"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Max"
                                            value={filters.capRateMax}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, capRateMax: e.target.value })); setPage(0); }}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Heatmap Layers Popover */}
                <Popover open={layersOpen} onOpenChange={setLayersOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={heatmapMetric !== 'none' ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                                "h-8 gap-1.5",
                                heatmapMetric !== 'none' && "bg-blue-600 hover:bg-blue-700"
                            )}
                        >
                            <Layers className="size-3.5" />
                            Layers
                            {heatmapMetric !== 'none' && (
                                <span className="text-[10px] opacity-80">
                                    ({heatmapOptions.find(o => o.value === heatmapMetric)?.label})
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-2">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 px-2 py-1">Map Layers</p>
                            {heatmapOptions.map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            setHeatmapMetric(option.value);
                                            setLayersOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors text-left",
                                            heatmapMetric === option.value
                                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                        )}
                                    >
                                        <Icon className="size-4 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium">{option.label}</div>
                                            {option.description && (
                                                <div className="text-[10px] text-gray-500 dark:text-gray-400">{option.description}</div>
                                            )}
                                        </div>
                                        {heatmapMetric === option.value && (
                                            <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">✓</span>
                                        )}
                                    </button>
                                );
                            })}
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
                            properties.slice(0, 20).map((property) => (
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
                                            <h4 className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {property.name}
                                            </h4>
                                            <p className="text-[10px] text-gray-500 truncate">{property.address}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                                    {property.price}
                                                </span>
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

                    {!loading && totalPages > 1 && (
                        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                            <PaginationButtonGroup
                                page={page + 1}
                                total={totalPages}
                                onPageChange={handlePageChange}
                                align="center"
                            />
                        </div>
                    )}
                </div>

                {/* Map */}
                <div className="flex-1 relative">
                    <PropertyMap
                        properties={properties}
                        selectedId={selectedId}
                        heatmapMetric={heatmapMetric}
                        className="absolute inset-0"
                        onBoundsChange={handleBoundsChange}
                    />
                </div>
            </div>
        </div>
    );
}
