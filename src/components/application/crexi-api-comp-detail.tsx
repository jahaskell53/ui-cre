"use client";

import { useEffect, useRef } from "react";
import { Building2, ExternalLink, Home, MapPin } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { PropertyDetailLayout } from "@/components/application/property-detail-layout";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

function yn(v: boolean | null | undefined): string {
    if (v === true) return "Yes";
    if (v === false) return "No";
    return "—";
}

function formatMaybeDate(s: string | null | undefined): string {
    if (!s?.trim()) return "—";
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    return s.trim();
}

export type CrexiApiCompDetail = {
    id: number;
    crexi_id: string | null;
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
    address_count: number | null;
    is_sales_comp: boolean | null;
    is_public_sales_comp: boolean | null;
    is_broker_reported_sales_comp: boolean | null;
    is_lease_comp: boolean | null;
    sale_type: string | null;
    days_on_market: number | null;
    date_activated: string | null;
    date_updated: string | null;
    description: string | null;
    scraped_at: string | Date | null;
};

function displayTitle(row: CrexiApiCompDetail): string {
    return (
        row.property_name?.trim() ||
        row.address_full?.trim() ||
        [row.address_street, row.city, row.state].filter(Boolean).join(", ") ||
        `Crexi API comp #${row.id}`
    );
}

function displaySubtitle(row: CrexiApiCompDetail): string {
    const parts = [row.city, row.state, row.zip].filter((p): p is string => Boolean(p?.trim()));
    return parts.join(", ") || row.county?.trim() || "";
}

export function CrexiApiCompDetail({ row, backHref }: { row: CrexiApiCompDetail; backHref?: string }) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        const lat = row.latitude;
        const lng = row.longitude;
        if (lat == null || lng == null || !mapContainerRef.current || mapInstance.current) return;

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
            new mapboxgl.Marker({ color: "#eab308" }).setLngLat([lng, lat]).addTo(map);
        });

        mapInstance.current = map;
        return () => {
            mapInstance.current?.remove();
            mapInstance.current = null;
        };
    }, [row.latitude, row.longitude]);

    const crexiWebUrl = row.crexi_id?.trim() ? `https://www.crexi.com/properties/${encodeURIComponent(row.crexi_id.trim())}` : null;

    const hero = (
        <div className="flex aspect-[3/1] min-h-[160px] items-center justify-center bg-gray-200 dark:bg-gray-700">
            {row.latitude != null && row.longitude != null ? (
                <div ref={mapContainerRef} className="h-full min-h-[160px] w-full" />
            ) : (
                <Building2 className="size-16 text-gray-400 dark:text-gray-500" />
            )}
        </div>
    );

    return (
        <PropertyDetailLayout
            backHref={backHref}
            title={displayTitle(row)}
            subtitle={
                displaySubtitle(row) ? (
                    <>
                        <MapPin className="size-3.5" />
                        {displaySubtitle(row)}
                    </>
                ) : (
                    <span className="text-muted-foreground">Crexi API comp</span>
                )
            }
            headerBadge={
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium",
                            "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200",
                        )}
                    >
                        Crexi API comp
                    </span>
                    {row.crexi_id?.trim() && (
                        <span className="rounded-lg bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {row.crexi_id.trim()}
                        </span>
                    )}
                </div>
            }
            hero={hero}
        >
            <section className="rounded-xl border border-gray-200 bg-white p-5 md:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                    <Home className="size-4" />
                    Property
                </h3>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-4 sm:col-span-2">
                        <dt className="shrink-0 text-gray-500 dark:text-gray-400">Address</dt>
                        <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                            {row.address_full?.trim() || [row.address_street, row.city, row.state, row.zip].filter(Boolean).join(", ") || "—"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">County</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.county?.trim() || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Document type</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.document_type?.trim() || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Property type</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.property_type?.trim() || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Subtype</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.property_subtype?.trim() || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Building sq ft</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.building_sqft != null ? row.building_sqft.toLocaleString() : "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Units</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.num_units ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Address count</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.address_count ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Sale type</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.sale_type?.trim() || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Days on market</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{row.days_on_market ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Activated</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{formatMaybeDate(row.date_activated ?? undefined)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Updated</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{formatMaybeDate(row.date_updated ?? undefined)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Sales comp</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{yn(row.is_sales_comp)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Public sales comp</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{yn(row.is_public_sales_comp)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Broker-reported comp</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{yn(row.is_broker_reported_sales_comp)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-gray-500 dark:text-gray-400">Lease comp</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{yn(row.is_lease_comp)}</dd>
                    </div>
                    {row.scraped_at && (
                        <div className="flex justify-between gap-4 sm:col-span-2">
                            <dt className="text-gray-500 dark:text-gray-400">Scraped at</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">
                                {new Date(row.scraped_at).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                })}
                            </dd>
                        </div>
                    )}
                </dl>
                {row.description?.trim() && (
                    <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
                        <h4 className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">Description</h4>
                        <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">{row.description.trim()}</p>
                    </div>
                )}
                {crexiWebUrl && (
                    <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
                        <a
                            href={crexiWebUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                            Open on Crexi
                            <ExternalLink className="size-3.5" />
                        </a>
                    </div>
                )}
            </section>
        </PropertyDetailLayout>
    );
}
