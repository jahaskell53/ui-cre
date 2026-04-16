"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { LoopnetListingDetail } from "@/components/application/loopnet-listing-detail";
import { ZillowListingDetail } from "@/components/application/zillow-listing-detail";
import { Button } from "@/components/ui/button";
import { type Listing, type LoopnetListing, type ZillowListing } from "@/lib/listings/listing-detail";

function LoadingSkeleton() {
    return (
        <div className="flex h-full flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
            <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-4 h-6 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="aspect-[3/1] min-h-[160px] animate-pulse bg-gray-200 dark:bg-gray-700" />
            <div className="grid max-w-4xl grid-cols-1 gap-6 p-6 md:grid-cols-2">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="space-y-3">
                            {[0, 1, 2].map((j) => (
                                <div key={j} className="flex justify-between">
                                    <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function NotFound({ backHref }: { backHref?: string }) {
    return (
        <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-6">
                {backHref && (
                    <Link
                        href={backHref}
                        className="inline-flex cursor-pointer items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        <ChevronLeft className="size-4" />
                        Back
                    </Link>
                )}
                <div className="mt-8 py-12 text-center">
                    <Building2 className="mx-auto mb-4 size-12 text-gray-300 dark:text-gray-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Listing not found</h2>
                    <p className="mt-1 text-sm text-gray-500">This listing may have been removed or the link is invalid.</p>
                    {backHref && (
                        <Button variant="outline" className="mt-4" asChild>
                            <Link href={backHref}>Back</Link>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ListingDetailContent({ id: rawId, backHref }: { id: string; backHref?: string }) {
    const [listing, setListing] = useState<Listing | null | undefined>(undefined);

    useEffect(() => {
        if (!rawId) return;

        async function load() {
            if (rawId.startsWith("zillow-")) {
                const uuid = rawId.slice("zillow-".length);
                const res = await fetch(`/api/listings/cleaned?id=${encodeURIComponent(uuid)}`);
                if (!res.ok) {
                    setListing(null);
                    return;
                }
                const row = await res.json();
                setListing({ source: "zillow", ...row } as ZillowListing);
            } else {
                const res = await fetch(`/api/listings/loopnet?id=${encodeURIComponent(rawId)}`);
                if (!res.ok) {
                    setListing(null);
                    return;
                }
                const row = await res.json();
                setListing({ source: "loopnet", ...row } as LoopnetListing);
            }
        }

        load();
    }, [rawId]);

    if (listing === undefined) return <LoadingSkeleton />;
    if (listing === null) return <NotFound backHref={backHref} />;

    if (listing.source === "zillow") {
        return <ZillowListingDetail listing={listing} backHref={backHref} />;
    }

    return <LoopnetListingDetail listing={listing} backHref={backHref} />;
}
