"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import Link from "next/link";
import type { Property } from "@/components/application/map/property-map";
import { cn } from "@/lib/utils";

const INITIAL_BATCH_SIZE = 50;
const BATCH_SIZE = 50;

interface PropertiesSidebarProps {
    properties: Property[];
    selectedId: string | number | null;
    loading: boolean;
    totalCount: number;
    onSelect: (id: string | number) => void;
    className?: string;
}

export function PropertiesListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-3">
                    <div className="flex gap-3">
                        <div className="h-12 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1">
                            <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                            <div className="mt-2 h-2 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                            <div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
}

export function PropertiesSidebar({ properties, selectedId, loading, totalCount, onSelect, className }: PropertiesSidebarProps) {
    const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setVisibleCount(INITIAL_BATCH_SIZE);
    }, [properties]);

    useEffect(() => {
        const sentinel = loadMoreRef.current;
        if (!sentinel || loading || visibleCount >= properties.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                setVisibleCount((current) => Math.min(current + BATCH_SIZE, properties.length));
            },
            {
                root: sentinel.parentElement,
                rootMargin: "0px 0px 200px 0px",
            },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loading, properties.length, visibleCount]);

    const visibleProperties = useMemo(() => properties.slice(0, visibleCount), [properties, visibleCount]);
    const showingCount = loading ? 0 : visibleProperties.length;

    return (
        <div
            className={cn(
                "z-10 flex h-1/2 w-full flex-col border-b border-gray-200 bg-white lg:h-full lg:w-72 lg:border-r lg:border-b-0 dark:border-gray-800 dark:bg-gray-900",
                className,
            )}
        >
            <div className="border-b border-gray-200 p-3 dark:border-gray-800">
                <span className="text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                    {loading ? "Loading..." : `${totalCount.toLocaleString()} Results · Showing ${showingCount.toLocaleString()}`}
                </span>
            </div>

            <div className="flex-1 divide-y divide-gray-200 overflow-auto dark:divide-gray-800">
                {loading ? (
                    <PropertiesListSkeleton count={4} />
                ) : properties.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">No properties found</div>
                ) : (
                    <>
                        {visibleProperties.map((property) => (
                            <div
                                key={property.id}
                                onClick={() => onSelect(property.id)}
                                className={cn(
                                    "cursor-pointer p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800",
                                    selectedId === property.id && "bg-gray-50 dark:bg-gray-800",
                                )}
                            >
                                <Link
                                    href={
                                        property.isReit && property.buildingZpid
                                            ? `/analytics/building/${encodeURIComponent(property.buildingZpid)}`
                                            : `/analytics/listing/${property.id}`
                                    }
                                    className="group flex gap-3"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="h-12 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                                        {property.thumbnailUrl ? (
                                            <img src={property.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                                <Building2 className="size-4 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1">
                                            <h4 className="flex-1 truncate text-xs font-medium text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
                                                {property.name}
                                            </h4>
                                            {property.isReit && (
                                                <span className="flex-shrink-0 rounded bg-violet-100 px-1 py-0.5 text-[8px] font-bold text-violet-700">
                                                    REIT
                                                </span>
                                            )}
                                        </div>
                                        <p className="truncate text-[10px] text-gray-500">{property.address}</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{property.price}</span>
                                            {property.isReit && property.units && <span className="text-[10px] text-gray-500">{property.units} units</span>}
                                            {property.capRate && <span className="text-[10px] text-gray-500">{property.capRate}</span>}
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))}
                        {visibleCount < properties.length && (
                            <div ref={loadMoreRef} aria-label="load-more-sentinel" className="p-3 text-center text-xs text-gray-500 dark:text-gray-400">
                                Loading more...
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
