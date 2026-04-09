"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListingDetailContent } from "@/components/application/listing-detail-content";

export default function BuildingPage() {
    const params = useParams();
    const zpid = params.zpid as string;

    const [listingId, setListingId] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        if (!zpid) return;

        async function resolve() {
            const res = await fetch(`/api/listings/cleaned?zpid=${encodeURIComponent(zpid)}&zpid_building=1`);
            if (!res.ok) {
                setListingId(null);
                return;
            }
            const row = await res.json();
            setListingId(`zillow-${row.id}`);
        }

        resolve();
    }, [zpid]);

    if (listingId === undefined) {
        return (
            <div className="flex h-full flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
                <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="mt-4 h-6 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
            </div>
        );
    }

    if (listingId === null) {
        return (
            <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
                <div className="p-6">
                    <Link
                        href="/analytics"
                        className="inline-flex cursor-pointer items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        <ChevronLeft className="size-4" />
                        Back
                    </Link>
                    <div className="mt-8 py-12 text-center">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Building not found</h2>
                        <p className="mt-1 text-sm text-gray-500">This building may have been removed or the link is invalid.</p>
                    </div>
                </div>
            </div>
        );
    }

    return <ListingDetailContent id={listingId} backHref="/analytics" />;
}
