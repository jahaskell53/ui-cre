"use client";

import { useParams } from "next/navigation";
import { ListingDetailContent } from "@/components/application/listing-detail-content";

export default function ListingDetailPage() {
    const params = useParams();
    return <ListingDetailContent id={params.id as string} backHref="/analytics" />;
}
