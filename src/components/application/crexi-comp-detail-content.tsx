"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, ChevronLeft, ExternalLink, FileText, MapPin, Users } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { PropertyDetailLayout } from "@/components/application/property-detail-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

export type CrexiCompDetail = {
    id: number;
    crexi_id: string | null;
    crexi_url: string | null;
    property_name: string | null;
    document_type: string | null;
    address_full: string | null;
    address_street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    county: string | null;
    latitude: number | null;
    longitude: number | null;
    property_type: string | null;
    property_subtype: string | null;
    building_sqft: number | null;
    num_units: number | null;
    sale_type: string | null;
    property_price_total: number | null;
    property_price_per_sqft: number | null;
    property_price_per_acre: number | null;
    sale_transaction_date: string | null;
    sale_cap_rate_percent: number | null;
    financials_cap_rate_percent: number | null;
    financials_noi: number | null;
    occupancy_rate_percent: number | null;
    gross_rent_annual: number | null;
    year_built: number | null;
    lot_size_sqft: number | null;
    lot_size_acre: number | null;
    zoning: string | null;
    is_opportunity_zone: boolean | null;
    investment_type: string | null;
    stories_count: number | null;
    construction_type: string | null;
    class_type: string | null;
    days_on_market: number | null;
    date_activated: string | null;
    date_updated: string | null;
    description: string | null;
    apn: string | null;
    lender: string | null;
    loan_amount: number | null;
    loan_type: string | null;
    interest_rate: number | null;
    loan_term: number | null;
    mortgage_maturity_date: string | null;
    mortgage_recording_date: string | null;
    title_company: string | null;
    tax_amount: number | null;
    tax_parcel_value: number | null;
    tax_land_value: number | null;
    tax_improvement_value: number | null;
    buildings_count: number | null;
    footprint_sqft: number | null;
    sale_buyer: string | null;
    sale_seller: string | null;
    owner_name: string | null;
    is_broker_reported_sales_comp: boolean | null;
    is_public_sales_comp: boolean | null;
    scraped_at: string | null;
};

function formatUsdCompact(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatOptionalUsd(value: number | null | undefined): string {
    if (value == null) return "—";
    return formatUsdCompact(value);
}

function pricePerDoor(row: CrexiCompDetail): number | null {
    if (row.num_units == null || row.num_units === 0 || row.property_price_total == null) return null;
    return row.property_price_total / row.num_units;
}

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
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Record not found</h2>
                    <p className="mt-1 text-sm text-gray-500">This Crexi comp may have been removed or the link is invalid.</p>
                </div>
            </div>
        </div>
    );
}

export function CrexiCompDetailContent({ compId, backHref }: { compId: string; backHref?: string }) {
    const [row, setRow] = useState<CrexiCompDetail | null | undefined>(undefined);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        if (!compId) return;
        let cancelled = false;
        (async () => {
            const res = await fetch(`/api/analytics/crexi-comp/${encodeURIComponent(compId)}`);
            if (cancelled) return;
            if (!res.ok) {
                setRow(null);
                return;
            }
            setRow((await res.json()) as CrexiCompDetail);
        })();
        return () => {
            cancelled = true;
        };
    }, [compId]);

    useEffect(() => {
        if (row == null || row === undefined) return;
        const lat = row.latitude;
        const lng = row.longitude;
        if (!lat || !lng || !mapContainerRef.current || mapInstance.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: "mapbox://styles/mapbox/light-v11",
            center: [lng, lat],
            zoom: 14,
            accessToken: MAPBOX_TOKEN,
            interactive: false,
            attributionControl: false,
        });

        map.on("load", () => {
            new mapboxgl.Marker({ color: "#2563eb" }).setLngLat([lng, lat]).addTo(map);
        });

        mapInstance.current = map;
        return () => {
            mapInstance.current?.remove();
            mapInstance.current = null;
        };
    }, [row]);

    if (row === undefined) return <LoadingSkeleton />;
    if (row === null) return <NotFound backHref={backHref} />;

    const title = row.property_name?.trim() || row.address_full?.trim() || row.address_street?.trim() || "Crexi comp";
    const locationLine = [row.city, row.state, row.zip].filter(Boolean).join(", ");
    const crexiHref = row.crexi_url ?? (row.crexi_id ? `https://www.crexi.com/property-records/${row.crexi_id}` : null);
    const ppd = pricePerDoor(row);

    const hero =
        row.latitude && row.longitude ? (
            <div ref={mapContainerRef} className="aspect-[3/1] min-h-[180px] w-full overflow-hidden rounded-xl" />
        ) : (
            <div className="flex aspect-[3/1] min-h-[160px] items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-700">
                <MapPin className="size-16 text-gray-400 dark:text-gray-500" />
            </div>
        );

    return (
        <PropertyDetailLayout
            backHref={backHref}
            title={title}
            subtitle={
                <>
                    <MapPin className="size-3.5" />
                    {locationLine || row.address_full || "—"}
                </>
            }
            headerBadge={
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200")}>
                        Crexi sale comp
                    </span>
                    {crexiHref && (
                        <Button variant="outline" size="sm" asChild>
                            <a href={crexiHref} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                                <ExternalLink className="size-3.5" />
                                Open on Crexi
                            </a>
                        </Button>
                    )}
                </div>
            }
            hero={hero}
        >
            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                    <Building2 className="size-4" />
                    Sale & pricing
                </h3>
                <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Sale price</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.property_price_total)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Sale date</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.sale_transaction_date
                                ? new Date(row.sale_transaction_date).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      timeZone: "UTC",
                                  })
                                : "—"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="flex shrink-0 items-center gap-1 text-gray-500 dark:text-gray-400">
                            <Users className="size-3.5" />
                            Units
                        </dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.num_units ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">$/door</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{ppd != null ? formatUsdCompact(ppd) : "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">$/SF</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.property_price_per_sqft)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Cap rate (sale)</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.sale_cap_rate_percent != null ? `${row.sale_cap_rate_percent.toFixed(2)}%` : "—"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Cap rate (financials)</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.financials_cap_rate_percent != null ? `${row.financials_cap_rate_percent.toFixed(2)}%` : "—"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">NOI</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.financials_noi)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Occupancy</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.occupancy_rate_percent != null ? `${row.occupancy_rate_percent.toFixed(1)}%` : "—"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Gross rent (annual)</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.gross_rent_annual)}</dd>
                    </div>
                </dl>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Property</h3>
                <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Type</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.property_type ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Subtype</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.property_subtype ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Class</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.class_type ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Year built</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.year_built ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Building SF</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.building_sqft != null ? row.building_sqft.toLocaleString() : "—"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Stories</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.stories_count ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Lot (acres)</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.lot_size_acre != null ? row.lot_size_acre.toLocaleString() : "—"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Zoning</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.zoning ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Opportunity zone</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.is_opportunity_zone == null ? "—" : row.is_opportunity_zone ? "Yes" : "No"}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Address & parcel</h3>
                <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Street</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.address_street ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Full address</dt>
                        <dd className="max-w-[60%] text-right font-medium break-words text-gray-900 dark:text-gray-100">{row.address_full ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">County</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.county ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">APN</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{row.apn ?? "—"}</dd>
                    </div>
                </dl>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Parties & financing</h3>
                <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Buyer</dt>
                        <dd className="max-w-[60%] text-right font-medium break-words text-gray-900 dark:text-gray-100">{row.sale_buyer ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Seller</dt>
                        <dd className="max-w-[60%] text-right font-medium break-words text-gray-900 dark:text-gray-100">{row.sale_seller ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Owner (record)</dt>
                        <dd className="max-w-[60%] text-right font-medium break-words text-gray-900 dark:text-gray-100">{row.owner_name ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Lender</dt>
                        <dd className="max-w-[60%] text-right font-medium break-words text-gray-900 dark:text-gray-100">{row.lender ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Loan amount</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.loan_amount)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Interest rate</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.interest_rate != null ? `${row.interest_rate.toFixed(3)}%` : "—"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Title company</dt>
                        <dd className="max-w-[60%] text-right font-medium break-words text-gray-900 dark:text-gray-100">{row.title_company ?? "—"}</dd>
                    </div>
                </dl>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Tax</h3>
                <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Annual tax</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.tax_amount)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Parcel value</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.tax_parcel_value)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Land value</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.tax_land_value)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Improvement value</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatOptionalUsd(row.tax_improvement_value)}</dd>
                    </div>
                </dl>
            </section>

            {row.description?.trim() && (
                <section className="rounded-xl border border-gray-200 bg-white p-5 md:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                        <FileText className="size-4" />
                        Description
                    </h3>
                    <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{row.description.trim()}</p>
                </section>
            )}
        </PropertyDetailLayout>
    );
}
