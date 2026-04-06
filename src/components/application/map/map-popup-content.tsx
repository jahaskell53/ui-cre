"use client";

import { Badge } from "@/components/ui/badge";

interface MapPopupContentProps {
    personName: string;
    category?: string | null;
    label: "Home" | "Owned";
    address: string;
}

export function MapPopupContent({ personName, category, label, address }: MapPopupContentProps) {
    return (
        <div className="w-[240px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-2 text-sm leading-tight font-semibold text-gray-900 dark:text-gray-100">{personName}</div>
            {category && (
                <div className="mb-2">
                    <Badge
                        variant="secondary"
                        className="border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                        {category}
                    </Badge>
                </div>
            )}
            <div className="mb-2">
                <Badge
                    variant="secondary"
                    className="border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                    {label}
                </Badge>
            </div>
            <div className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{address}</div>
        </div>
    );
}
