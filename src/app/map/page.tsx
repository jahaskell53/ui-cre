"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { SearchLg, FilterLines, Loading03, ChevronLeft, ChevronRight } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
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
        <MainLayout>
            <div className="flex flex-col h-[calc(100vh-8rem)]">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-display-sm font-semibold text-primary">Property Map</h1>
                        <p className="text-lg text-tertiary">Discover {totalCount} multi-family opportunities across the Bay Area.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Input
                            icon={SearchLg}
                            placeholder="Search zip, address, market..."
                            className="w-full sm:w-32 lg:w-64"
                            value={searchQuery}
                            onChange={(value) => {
                                setSearchQuery(value);
                                setPage(0); // Reset to first page on search
                            }}
                        />
                        <Button color="secondary" iconLeading={FilterLines}>Filters</Button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col-reverse lg:flex-row border border-secondary rounded-2xl overflow-hidden bg-primary shadow-sm relative">
                    {/* Map Sidebar */}
                    <div className="w-full lg:w-80 h-1/2 lg:h-auto border-t lg:border-t-0 lg:border-r border-secondary flex flex-col bg-primary z-10">
                        <div className="p-4 border-b border-secondary flex justify-between items-center bg-primary">
                            <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
                                {loading ? 'Loading...' : `Results ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, totalCount)}`}
                            </span>
                        </div>

                        <div className="flex-1 overflow-auto divide-y divide-secondary">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center p-8 text-tertiary gap-3 h-full">
                                    <Loading03 className="w-6 h-6 animate-spin" />
                                    <p className="text-sm">Fetching properties...</p>
                                </div>
                            ) : properties.length === 0 ? (
                                <div className="p-8 text-center text-tertiary">
                                    <p>No geocoded properties found. Run the geocoding script to populate coordinates.</p>
                                </div>
                            ) : (
                                properties.map((property) => (
                                    <div
                                        key={property.id}
                                        onClick={() => setSelectedId(property.id)}
                                        className={`p-4 hover:bg-secondary cursor-pointer transition-colors ${selectedId === property.id ? 'bg-secondary' : ''}`}
                                    >
                                        <div className="aspect-video bg-hover rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                                            {property.thumbnailUrl ? (
                                                <img
                                                    src={property.thumbnailUrl}
                                                    alt={property.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="text-xs text-tertiary italic">No Image</div>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-primary truncate" title={property.name}>{property.name}</h3>
                                        <p className="text-sm text-tertiary truncate">{property.address}</p>
                                        {property.location && (
                                            <p className="text-xs text-secondary font-medium mb-2 truncate">{property.location}</p>
                                        )}
                                        <div className="flex justify-between items-center text-sm">
                                            {property.units && property.units > 0 ? (
                                                <span className="text-primary font-medium">{property.units} Units</span>
                                            ) : <span />}
                                            <span className="text-brand-solid font-semibold">{property.price}</span>
                                        </div>
                                        {(property.capRate || property.squareFootage) && (
                                            <div className="mt-2 flex flex-wrap gap-2 items-center">
                                                {property.capRate && (
                                                    <span className="text-xs font-semibold text-tertiary bg-secondary-subtle px-2 py-0.5 rounded-md border border-secondary">
                                                        {property.capRate}
                                                    </span>
                                                )}
                                                {property.squareFootage && (
                                                    <span className="text-xs font-semibold text-tertiary bg-secondary-subtle px-2 py-0.5 rounded-md border border-secondary">
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
                            <div className="p-4 border-t border-secondary bg-primary flex items-center justify-between gap-2">
                                <Button
                                    color="secondary"
                                    size="sm"
                                    onClick={handlePrev}
                                    disabled={page === 0}
                                    iconLeading={ChevronLeft}
                                >
                                    Prev
                                </Button>
                                <span className="text-sm font-medium text-secondary">
                                    {currentPageDisplay} / {totalPages}
                                </span>
                                <Button
                                    color="secondary"
                                    size="sm"
                                    onClick={handleNext}
                                    disabled={currentPageDisplay >= totalPages}
                                    iconTrailing={ChevronRight}
                                >
                                    Next
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
        </MainLayout>
    );
}
