"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { SearchLg, FilterLines, Map01 } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";
import { PropertyMap, type Property } from "@/components/application/map/property-map";

const PROPERTIES: Property[] = [
    { id: 1, name: 'Palms at Mission', address: '8200 Mission St, San Francisco', units: 120, price: '$18.5M', coordinates: [-122.4194, 37.7749] },
    { id: 2, name: 'The Heights', address: '123 Market St, San Francisco', units: 85, price: '$12.2M', coordinates: [-122.4014, 37.7889] },
    { id: 3, name: 'Oakland Lofts', address: '456 Broadway, Oakland', units: 45, price: '$8.7M', coordinates: [-122.2711, 37.8044] },
    { id: 4, name: 'Sunnyvale Garden', address: '789 Garden Way, Sunnyvale', units: 200, price: '$45M', coordinates: [-122.0363, 37.3688] },
];

export default function MapPage() {
    const [selectedId, setSelectedId] = useState<number | null>(null);

    return (
        <MainLayout>
            <div className="flex flex-col h-[calc(100vh-8rem)]">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-display-sm font-semibold text-primary">Property Map</h1>
                        <p className="text-lg text-tertiary">Discover and analyze multi-family opportunities.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Input icon={SearchLg} placeholder="Search zip, address, market..." className="w-full sm:w-64" />
                        <Button color="secondary" iconLeading={FilterLines}>Filters</Button>
                    </div>
                </div>

                <div className="flex-1 flex border border-secondary rounded-2xl overflow-hidden bg-primary shadow-sm">
                    {/* Map Sidebar */}
                    <div className="w-80 border-r border-secondary flex flex-col bg-primary">
                        <div className="p-4 border-b border-secondary">
                            <span className="text-sm font-semibold text-secondary uppercase tracking-wider">{PROPERTIES.length} Results in Bay Area, CA</span>
                        </div>
                        <div className="flex-1 overflow-auto divide-y divide-secondary">
                            {PROPERTIES.map((property) => (
                                <div
                                    key={property.id}
                                    onClick={() => setSelectedId(property.id)}
                                    className={`p-4 hover:bg-secondary cursor-pointer transition-colors ${selectedId === property.id ? 'bg-secondary' : ''}`}
                                >
                                    <div className="aspect-video bg-secondary rounded-lg mb-3" />
                                    <h3 className="font-semibold text-primary">{property.name}</h3>
                                    <p className="text-sm text-tertiary mb-2">{property.address}</p>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-primary font-medium">{property.units} Units</span>
                                        <span className="text-brand-solid font-semibold">{property.price}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Interactive Map */}
                    <div className="flex-1 relative">
                        <PropertyMap
                            properties={PROPERTIES}
                            selectedId={selectedId}
                            className="absolute inset-0"
                        />
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
