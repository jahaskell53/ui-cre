"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { SearchLg, FilterLines, Loading03 } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { PropertyMap, type Property } from "@/components/application/map/property-map";
import { supabase } from "@/utils/supabase";

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

async function geocodeAddress(address: string): Promise<[number, number] | null> {
    try {
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            return data.features[0].center; // [lng, lat]
        }
    } catch (e) {
        console.error('Geocoding error:', e);
    }
    return null;
}

export default function MapPage() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAndGeocode() {
            setLoading(true);
            const { data, error } = await supabase
                .from('loopnet_listings')
                .select('*')
                .not('address', 'is', null)
                .limit(20);

            if (error) {
                console.error('Error fetching listings:', error);
                setLoading(false);
                return;
            }

            const geocodedProperties = await Promise.all(
                data.map(async (item) => {
                    // Combine address and location for better geocoding results
                    const fullAddress = `${item.address}, ${item.location}`;
                    const coords = await geocodeAddress(fullAddress);

                    if (!coords) return null;

                    return {
                        id: item.id,
                        name: item.headline || 'Investment Opportunity',
                        address: item.address,
                        // Mocking units from sqft if units not available, or just use 0
                        units: item.square_footage ? Math.floor(parseInt(item.square_footage.replace(/[^0-9]/g, '') || '0') / 500) : 0,
                        price: item.price || 'TBD',
                        coordinates: coords,
                        thumbnailUrl: item.thumbnail_url
                    } as Property;
                })
            );

            const filtered = geocodedProperties.filter((p): p is Property => p !== null);
            setProperties(filtered);
            setLoading(false);
        }

        fetchAndGeocode();
    }, []);

    return (
        <MainLayout>
            <div className="flex flex-col h-[calc(100vh-8rem)]">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-display-sm font-semibold text-primary">Property Map</h1>
                        <p className="text-lg text-tertiary">Discover and analyze multi-family opportunities from LoopNet.</p>
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
                                {loading ? 'Fetching...' : `${properties.length} Results from Database`}
                            </span>
                        </div>
                        <div className="flex-1 overflow-auto divide-y divide-secondary">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center p-8 text-tertiary gap-3">
                                    <Loading03 className="w-6 h-6 animate-spin" />
                                    <p className="text-sm">Geocoding addresses...</p>
                                </div>
                            ) : properties.length === 0 ? (
                                <div className="p-8 text-center text-tertiary">
                                    <p>No properties found with valid addresses.</p>
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
                                        <p className="text-sm text-tertiary mb-2">{property.address}</p>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-primary font-medium">{property.units} Units</span>
                                            <span className="text-brand-solid font-semibold">{property.price}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Interactive Map */}
                    <div className="flex-1 relative">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 flex items-center justify-center">
                                <div className="bg-primary p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                                    <Loading03 className="w-8 h-8 animate-spin text-brand-solid" />
                                    <p className="font-medium text-primary">Mapping properties...</p>
                                </div>
                            </div>
                        )}
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
