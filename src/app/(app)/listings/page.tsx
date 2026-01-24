"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Filter, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyMap, type Property } from "@/components/application/map/property-map";
import { PaginationButtonGroup } from "@/components/application/pagination/pagination";
import { supabase } from "@/utils/supabase";

const PAGE_SIZE = 200;

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

export default function MapPage() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState<Filters>(defaultFilters);
    const [filtersOpen, setFiltersOpen] = useState(false);

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

    const parsePrice = (priceStr: string): number | null => {
        if (!priceStr) return null;
        const cleaned = priceStr.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    };

    const parseCapRate = (capRateStr: string): number | null => {
        if (!capRateStr) return null;
        const cleaned = capRateStr.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    };

    const parseSqft = (sqftStr: string): number | null => {
        if (!sqftStr) return null;
        const cleaned = sqftStr.replace(/[^0-9]/g, '');
        const num = parseInt(cleaned, 10);
        return isNaN(num) ? null : num;
    };

    const fetchProperties = useCallback(async (pageNum: number, search: string, currentFilters: Filters) => {
        setLoading(true);

        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // Build query
        let query = supabase
            .from('loopnet_listings')
            .select('*', { count: 'exact' })
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('created_at', { ascending: false });

        if (search) {
            // Search in headline, address, and location
            query = query.or(`headline.ilike.%${search}%,address.ilike.%${search}%,location.ilike.%${search}%`);
        }

        // Apply price filters using numeric_price column
        if (currentFilters.priceMin) {
            const minPrice = parseFloat(currentFilters.priceMin);
            if (!isNaN(minPrice)) {
                query = query.gte('numeric_price', minPrice);
            }
        }
        if (currentFilters.priceMax) {
            const maxPrice = parseFloat(currentFilters.priceMax);
            if (!isNaN(maxPrice)) {
                query = query.lte('numeric_price', maxPrice);
            }
        }

        // Apply cap rate filters using numeric_cap_rate column
        if (currentFilters.capRateMin) {
            const minCapRate = parseFloat(currentFilters.capRateMin);
            if (!isNaN(minCapRate)) {
                query = query.gte('numeric_cap_rate', minCapRate);
            }
        }
        if (currentFilters.capRateMax) {
            const maxCapRate = parseFloat(currentFilters.capRateMax);
            if (!isNaN(maxCapRate)) {
                query = query.lte('numeric_cap_rate', maxCapRate);
            }
        }

        // Apply square footage filters using numeric_square_footage column
        if (currentFilters.sqftMin) {
            const minSqft = parseFloat(currentFilters.sqftMin);
            if (!isNaN(minSqft)) {
                query = query.gte('numeric_square_footage', minSqft);
            }
        }
        if (currentFilters.sqftMax) {
            const maxSqft = parseFloat(currentFilters.sqftMax);
            if (!isNaN(maxSqft)) {
                query = query.lte('numeric_square_footage', maxSqft);
            }
        }

        const { data, error, count } = await query.range(from, to);

        if (error) {
            console.error('Error fetching listings:', error);
            setLoading(false);
            return;
        }

        const mappedProperties: Property[] = data.map((item) => ({
            id: item.id,
            name: item.headline || item.address || 'Building',
            address: item.address || 'Address not listed',
            location: item.location,
            units: item.square_footage ? (Math.floor(parseInt(item.square_footage.replace(/[^0-9]/g, '') || '0') / 500) || null) : null,
            price: item.price || 'TBD',
            coordinates: [item.longitude, item.latitude],
            thumbnailUrl: item.thumbnail_url,
            capRate: item.cap_rate,
            squareFootage: item.square_footage
        }));

        setProperties(mappedProperties);
        if (count !== null) setTotalCount(count);
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProperties(page, searchQuery, filters);
        }, searchQuery ? 500 : 0); // debounce 500ms for search, immediate for pagination

        return () => clearTimeout(timer);
    }, [page, searchQuery, filters, fetchProperties]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const handlePageChange = (newPage: number) => {
        // Pagination component uses 1-indexed pages, convert to 0-indexed
        setPage(newPage - 1);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden p-6">
            <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Property Map</h1>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-32 lg:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                                <Input
                                    placeholder="Search zip, address, market..."
                                    className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(0); // Reset to first page on search
                                    }}
                                />
                            </div>
                            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 relative">
                                        <Filter className="size-4" />
                                        Filters
                                        {activeFilterCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center">
                                                {activeFilterCount}
                                            </span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-80 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100">Filters</h3>
                                            {activeFilterCount > 0 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={clearFilters}
                                                    className="h-auto px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                                >
                                                    Clear all
                                                </Button>
                                            )}
                                        </div>

                                        {/* Price Range */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Price</Label>
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    type="number"
                                                    placeholder="Min"
                                                    value={filters.priceMin}
                                                    onChange={(e) => {
                                                        setFilters(prev => ({ ...prev, priceMin: e.target.value }));
                                                        setPage(0);
                                                    }}
                                                    className="h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                                />
                                                <span className="text-gray-400">-</span>
                                                <Input
                                                    type="number"
                                                    placeholder="Max"
                                                    value={filters.priceMax}
                                                    onChange={(e) => {
                                                        setFilters(prev => ({ ...prev, priceMax: e.target.value }));
                                                        setPage(0);
                                                    }}
                                                    className="h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                                />
                                            </div>
                                        </div>

                                        {/* Cap Rate Range */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cap Rate (%)</Label>
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    placeholder="Min"
                                                    value={filters.capRateMin}
                                                    onChange={(e) => {
                                                        setFilters(prev => ({ ...prev, capRateMin: e.target.value }));
                                                        setPage(0);
                                                    }}
                                                    className="h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                                />
                                                <span className="text-gray-400">-</span>
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    placeholder="Max"
                                                    value={filters.capRateMax}
                                                    onChange={(e) => {
                                                        setFilters(prev => ({ ...prev, capRateMax: e.target.value }));
                                                        setPage(0);
                                                    }}
                                                    className="h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                                />
                                            </div>
                                        </div>

                                        {/* Square Footage Range */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Square Footage</Label>
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    type="number"
                                                    placeholder="Min"
                                                    value={filters.sqftMin}
                                                    onChange={(e) => {
                                                        setFilters(prev => ({ ...prev, sqftMin: e.target.value }));
                                                        setPage(0);
                                                    }}
                                                    className="h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                                />
                                                <span className="text-gray-400">-</span>
                                                <Input
                                                    type="number"
                                                    placeholder="Max"
                                                    value={filters.sqftMax}
                                                    onChange={(e) => {
                                                        setFilters(prev => ({ ...prev, sqftMax: e.target.value }));
                                                        setPage(0);
                                                    }}
                                                    className="h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                    {/* Map Sidebar */}
                    <div className="w-full lg:w-80 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 z-10">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {loading ? 'Loading...' : `Results ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, totalCount)}`}
                            </span>
                        </div>

                        <div className="flex-1 overflow-auto divide-y divide-gray-200 dark:divide-gray-800">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400 gap-3 h-full">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <p className="text-sm">Fetching properties...</p>
                                </div>
                            ) : properties.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    <p>No geocoded properties found. Run the geocoding script to populate coordinates.</p>
                                </div>
                            ) : (
                                properties.map((property) => (
                                    <div
                                        key={property.id}
                                        onClick={() => setSelectedId(property.id)}
                                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${selectedId === property.id ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
                                    >
                                        <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700">
                                            {property.thumbnailUrl ? (
                                                <img
                                                    src={property.thumbnailUrl}
                                                    alt={property.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="text-xs text-gray-400 italic">No Image</div>
                                            )}
                                        </div>
                                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm" title={property.name}>{property.name}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{property.address}</p>
                                        {property.location && (
                                            <p className="text-[10px] text-gray-400 font-medium mb-2 truncate uppercase">{property.location}</p>
                                        )}
                                        <div className="flex justify-between items-center text-xs mt-2">
                                            {property.units && property.units > 0 ? (
                                                <span className="text-gray-700 dark:text-gray-300">{property.units} Units</span>
                                            ) : <span />}
                                            <span className="text-gray-900 dark:text-gray-100 font-semibold">{property.price}</span>
                                        </div>
                                        {(property.capRate || property.squareFootage) && (
                                            <div className="mt-2 flex flex-wrap gap-2 items-center">
                                                {property.capRate && (
                                                    <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                                        {property.capRate}
                                                    </span>
                                                )}
                                                {property.squareFootage && (
                                                    <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                                        {property.squareFootage}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination Footer */}
                        {!loading && totalPages > 1 && (
                            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                                <PaginationButtonGroup
                                    page={page + 1}
                                    total={totalPages}
                                    onPageChange={handlePageChange}
                                    align="center"
                                />
                            </div>
                        )}
                    </div>

                    {/* Interactive Map */}
                    <div className="flex-1 relative">
                        <PropertyMap
                            properties={properties}
                            selectedId={selectedId}
                            className="absolute inset-0"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}


