"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PropertyMap, type Property } from "@/components/application/map/property-map";
import { supabase } from "@/utils/supabase";

const PAGE_SIZE = 200;

export default function MapPage() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchProperties = useCallback(async (pageNum: number, search: string) => {
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
            fetchProperties(page, searchQuery);
        }, searchQuery ? 500 : 0); // debounce 500ms for search, immediate for pagination

        return () => clearTimeout(timer);
    }, [page, searchQuery, fetchProperties]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const currentPageDisplay = page + 1;

    const handleNext = () => {
        if (currentPageDisplay < totalPages) {
            setPage(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (page > 0) {
            setPage(prev => prev - 1);
        }
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
                            <Button variant="outline" className="border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                                <Filter className="size-4" />
                                Filters
                            </Button>
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
                            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePrev}
                                    disabled={page === 0}
                                    className="h-8 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                                >
                                    <ChevronLeft className="size-4" />
                                    Prev
                                </Button>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {currentPageDisplay} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleNext}
                                    disabled={currentPageDisplay >= totalPages}
                                    className="h-8 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400"
                                >
                                    Next
                                    <ChevronRight className="size-4" />
                                </Button>
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


