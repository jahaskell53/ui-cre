"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const mockUserProperties = [
    { id: 1, address: "1228 El Camino", capRate: 5.2, image: null },
    { id: 2, address: "550 Blake", capRate: 3.47, image: null },
    { id: 3, address: "3541 Mission", capRate: 2.67, image: null },
];

export default function PropertiesPage() {
    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Properties</h2>
                <Button size="sm" className="gap-1">
                    <Building2 className="size-4" />
                    Add Property
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {mockUserProperties.map((property) => (
                    <Link
                        key={property.id}
                        href={`/analytics/your-properties/${property.id}`}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group block"
                    >
                        <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-700 relative">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Building2 className="size-12 text-gray-300 dark:text-gray-600" />
                            </div>
                            <div className="absolute top-3 right-3 bg-white dark:bg-gray-800 px-2 py-1 rounded-md shadow-sm">
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {property.capRate}%
                                </span>
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {property.address}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Cap Rate</p>
                        </div>
                    </Link>
                ))}

                {/* Add Property Card */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer flex items-center justify-center min-h-[200px]">
                    <div className="text-center">
                        <div className="size-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                            <Building2 className="size-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Add Property</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
