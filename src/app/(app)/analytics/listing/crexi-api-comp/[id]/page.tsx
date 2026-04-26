"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CrexiApiCompDetail, type CrexiApiCompDetail as CrexiApiCompRow } from "@/components/application/crexi-api-comp-detail";
import { Button } from "@/components/ui/button";

const BACK_HREF = "/analytics/listings";

function LoadingSkeleton() {
    return (
        <div className="flex h-full flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
            <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="mt-4 h-6 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="aspect-[3/1] min-h-[160px] animate-pulse bg-gray-200 dark:bg-gray-700" />
        </div>
    );
}

function NotFound() {
    return (
        <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-6">
                <Link
                    href={BACK_HREF}
                    className="inline-flex cursor-pointer items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                    <ChevronLeft className="size-4" />
                    Back
                </Link>
                <div className="mt-8 py-12 text-center">
                    <Building2 className="mx-auto mb-4 size-12 text-gray-300 dark:text-gray-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Comp not found</h2>
                    <p className="mt-1 text-sm text-gray-500">This record may have been removed or the id is invalid.</p>
                    <Button variant="outline" className="mt-4" asChild>
                        <Link href={BACK_HREF}>Back to map</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function CrexiApiCompDetailPage() {
    const params = useParams();
    const rawId = params.id as string;
    const [row, setRow] = useState<CrexiApiCompRow | null | undefined>(undefined);

    useEffect(() => {
        if (!rawId) return;
        const idNum = parseInt(rawId, 10);
        if (Number.isNaN(idNum)) {
            setRow(null);
            return;
        }
        let cancelled = false;
        (async () => {
            const res = await fetch(`/api/listings/crexi-api-comps?id=${encodeURIComponent(String(idNum))}`);
            if (cancelled) return;
            if (!res.ok) {
                setRow(null);
                return;
            }
            const data = (await res.json()) as CrexiApiCompRow;
            setRow(data);
        })();
        return () => {
            cancelled = true;
        };
    }, [rawId]);

    if (row === undefined) return <LoadingSkeleton />;
    if (row === null) return <NotFound />;

    return <CrexiApiCompDetail row={row} backHref={BACK_HREF} />;
}
