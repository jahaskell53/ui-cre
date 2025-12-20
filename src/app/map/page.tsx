"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { SearchLg, FilterLines, Map01 } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { Button } from "@/components/base/buttons/button";

export default function MapPage() {
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
                            <span className="text-sm font-semibold text-secondary uppercase tracking-wider">24 Results in Miami, FL</span>
                        </div>
                        <div className="flex-1 overflow-auto divide-y divide-secondary">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="p-4 hover:bg-secondary cursor-pointer transition-colors">
                                    <div className="aspect-video bg-secondary rounded-lg mb-3" />
                                    <h3 className="font-semibold text-primary">Palms at Dadeland</h3>
                                    <p className="text-sm text-tertiary mb-2">8200 SW 72nd Ave, Miami, FL 33143</p>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-primary font-medium">120 Units</span>
                                        <span className="text-brand-solid font-semibold">$18.5M</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Interactive Map Mock */}
                    <div className="flex-1 bg-secondary flex items-center justify-center relative">
                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#9e77ed 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                        <div className="flex flex-col items-center gap-4 text-tertiary">
                            <Map01 className="size-12 opacity-50" />
                            <p className="font-medium text-lg">Interactive Map Integration</p>
                            <p className="text-sm">Connect with Mapbox or Google Maps API</p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
