"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, DollarSign, ExternalLink, FileText, Home, MapPin } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { PropertyDetailLayout } from "@/components/application/property-detail-layout";
import { type LoopnetListing, getListingDisplayAddress } from "@/lib/listings/listing-detail";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

export function LoopnetListingDetail({ listing, backHref }: { listing: LoopnetListing; backHref?: string }) {
    const [offMarketDate, setOffMarketDate] = useState<string | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        async function checkOffMarket() {
            const latestRunRes = await fetch("/api/listings/loopnet?latest_run_id=1");
            if (!latestRunRes.ok) return;
            const { run_id: latestRunId } = await latestRunRes.json();
            if (!latestRunId) return;
            const listingRunId = (listing as unknown as Record<string, unknown>).run_id;
            if (listingRunId != null && listingRunId !== latestRunId) {
                const createdAt = listing.created_at;
                if (createdAt) setOffMarketDate(createdAt);
            }
        }
        checkOffMarket();
    }, [listing]);

    useEffect(() => {
        const { latitude: lat, longitude: lng } = listing;
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
            new mapboxgl.Marker({ color: "#f97316" }).setLngLat([lng, lat]).addTo(map);
        });

        mapInstance.current = map;
        return () => {
            mapInstance.current?.remove();
            mapInstance.current = null;
        };
    }, [listing]);

    const displayAddress = getListingDisplayAddress(listing);

    const hero = listing.thumbnail_url ? (
        <div className="aspect-[3/1] min-h-[180px] overflow-hidden">
            <img src={listing.thumbnail_url} alt="" className="h-full w-full object-cover" />
        </div>
    ) : (
        <div className="flex aspect-[3/1] min-h-[160px] items-center justify-center bg-gray-200 dark:bg-gray-700">
            <Building2 className="size-16 text-gray-400 dark:text-gray-500" />
        </div>
    );

    return (
        <PropertyDetailLayout
            backHref={backHref}
            title={displayAddress}
            subtitle={
                <>
                    <MapPin className="size-3.5" />
                    {listing.location || ""}
                </>
            }
            headerBadge={
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium",
                            "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                        )}
                    >
                        LoopNet Sale
                    </span>
                    {listing.cap_rate && (
                        <div className="rounded-lg bg-gray-100 px-3 py-1.5 dark:bg-gray-800">
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{listing.cap_rate}</span>
                            <span className="ml-1 text-xs text-gray-500">Cap Rate</span>
                        </div>
                    )}
                </div>
            }
            hero={hero}
        >
            {/* Overview */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                    <Home className="size-4" />
                    Overview
                </h3>
                <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Price</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.price || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Cap Rate</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.cap_rate || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Category</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.building_category || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Sq Ft</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.square_footage || "—"}</dd>
                    </div>
                    {listing.created_at && (
                        <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Listed on</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">
                                {new Date(listing.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </dd>
                        </div>
                    )}
                    {offMarketDate && (
                        <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Off market</dt>
                            <dd className="font-medium text-orange-600 dark:text-orange-400">
                                {new Date(offMarketDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </dd>
                        </div>
                    )}
                </dl>
            </section>

            {/* Listing Details */}
            <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                    <DollarSign className="size-4" />
                    Listing Details
                </h3>
                <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Headline</dt>
                        <dd className="max-w-[180px] text-right font-medium text-gray-900 dark:text-gray-100">{listing.headline || "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Location</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.location || "—"}</dd>
                    </div>
                    {listing.listing_url && (
                        <div className="pt-2">
                            <a
                                href={listing.listing_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
                            >
                                View on LoopNet
                                <ExternalLink className="size-3.5" />
                            </a>
                        </div>
                    )}
                    {listing.om_url && (
                        <div className="pt-2">
                            <a
                                href={listing.om_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
                            >
                                View Offering Memorandum
                                <ExternalLink className="size-3.5" />
                            </a>
                        </div>
                    )}
                </dl>
            </section>

            {/* Map */}
            {listing.latitude && listing.longitude && (
                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                        <MapPin className="size-4 text-gray-500" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Location</h3>
                    </div>
                    <div ref={mapContainerRef} className="h-full min-h-48 w-full" />
                </section>
            )}

            {listing.attachment_urls && listing.attachment_urls.length > 0 && (
                <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                        <FileText className="size-4" />
                        Documents
                        <span className="ml-1 text-sm font-normal text-gray-500">
                            ({listing.attachment_urls.length} file{listing.attachment_urls.length !== 1 ? "s" : ""})
                        </span>
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {listing.attachment_urls.map((att, i) => (
                            <li key={`${att.source_url}-${i}`}>
                                <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                                >
                                    {att.description?.trim() || `Document ${i + 1}`}
                                    <ExternalLink className="size-3.5 shrink-0" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Unit Mix */}
            {listing.unit_mix && listing.unit_mix.length > 0 && (
                <section className="rounded-xl border border-gray-200 bg-white p-5 md:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-4 flex items-center gap-2">
                        <Building2 className="size-4 text-gray-900 dark:text-gray-100" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            Unit Mix
                            <span className="ml-1 text-sm font-normal text-gray-500">
                                ({listing.unit_mix.length} type{listing.unit_mix.length !== 1 ? "s" : ""})
                            </span>
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/30">
                                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wider text-gray-500 uppercase">Type</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Units</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Rent</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Sq Ft</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listing.unit_mix.map((row, i) => (
                                    <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50">
                                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{row.description || "—"}</td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{row.count || "—"}</td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{row.rent || "—"}</td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{row.sqft || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </PropertyDetailLayout>
    );
}
