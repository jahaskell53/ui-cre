"use client";

import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { SearchLg, FilterLines, Loading03, ChevronDown } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { PropertyMap, type Property } from "@/components/application/map/property-map";
import { supabase } from "@/utils/supabase";

const PAGE_SIZE = 200;

export default function MapPage() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const fetchProperties = useCallback(async (pageNum: number) => {
        if (pageNum === 0) setLoading(true);
        else setLoadingMore(true);

        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        // Fetch everything that has coordinates stored in the DB
        const { data, error, count } = await supabase
            .from('loopnet_listings')
            .select('*', { count: 'exact' })
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Error fetching listings:', error);
            setLoading(false);
            setLoadingMore(false);
            return;
        }

        const mappedProperties: Property[] = data.map((item) => ({
            id: item.id,
            name: item.headline || 'Investment Opportunity',
            address: item.address || 'Address not listed',
            units: item.square_footage ? (Math.floor(parseInt(item.square_footage.replace(/[^0-9]/g, '') || '0') / 500) || null) : null,
            price: item.price || 'TBD',
            coordinates: [item.longitude, item.latitude], // [lng, lat] from DB
            thumbnailUrl: item.thumbnail_url,
            capRate: item.cap_rate
        }));

        setProperties(prev => pageNum === 0 ? mappedProperties : [...prev, ...mappedProperties]);
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
        setLoadingMore(false);
    }, []);

    useEffect(() => {
        fetchProperties(0);
    }, [fetchProperties]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchProperties(nextPage);
    };

    return (
        <MainLayout>
            <div className="flex flex-col h-[calc(100vh-8rem)]">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-display-sm font-semibold text-primary">Property Map</h1>
                        <p className="text-lg text-tertiary">Discover {properties.length} multi-family opportunities across the Bay Area.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Input icon={SearchLg} placeholder="Search zip, address, market..." className="w-full sm:w-64" />
                        <Button color="secondary" iconLeading={FilterLines}>Filters</Button>
                    </div>
                </div>

                <div className="flex-1 flex border border-secondary rounded-2xl overflow-hidden bg-primary shadow-sm relative">
                    {/* Map Sidebar */}
                    <div className="w-80 border-r border-secondary flex flex-col bg-primary z-10">
                        <div className="p-4 border-b border-secondary">
                            <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
                                {loading && page === 0 ? 'Loading...' : `${properties.length} Results Found`}
                            </span>
                        </div>
                        <div className="flex-1 overflow-auto divide-y divide-secondary">
                            {loading && page === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-tertiary gap-3">
                                    <Loading03 className="w-6 h-6 animate-spin" />
                                    <p className="text-sm">Fetching properties...</p>
                                </div>
                            ) : properties.length === 0 ? (
                                <div className="p-8 text-center text-tertiary">
                                    <p>No geocoded properties found. Run the geocoding script to populate coordinates.</p>
                                </div>
                            ) : (
                                <>
                                    {properties.map((property) => (
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
                                            <p className="text-sm text-tertiary mb-2 line-clamp-1">{property.address}</p>
                                            <div className="flex justify-between items-center text-sm">
                                                {property.units && property.units > 0 ? (
                                                    <span className="text-primary font-medium">{property.units} Units</span>
                                                ) : <span />}
                                                <span className="text-brand-solid font-semibold">{property.price}</span>
                                            </div>
                                            {property.capRate && (
                                                <div className="mt-2 flex items-center">
                                                    <span className="text-xs font-semibold text-tertiary bg-secondary-subtle px-2 py-0.5 rounded-md">
                                                        {property.capRate}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {hasMore && (
                                        <div className="p-4">
                                            <Button
                                                className="w-full"
                                                color="secondary"
                                                onClick={handleLoadMore}
                                                disabled={loadingMore}
                                                iconLeading={loadingMore ? Loading03 : ChevronDown}
                                                iconLeadingClassName={loadingMore ? "animate-spin" : ""}
                                            >
                                                {loadingMore ? 'Loading...' : 'Load More'}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
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
