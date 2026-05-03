"use client";

import { useParams, useSearchParams } from "next/navigation";
import { CrexiCompDetailContent } from "@/components/application/crexi-comp-detail-content";

export default function CrexiCompDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params.id as string;
    const from = searchParams.get("from");
    const backHref = from ? decodeURIComponent(from) : "/analytics/sales-trends";
    return <CrexiCompDetailContent compId={id} backHref={backHref} />;
}
