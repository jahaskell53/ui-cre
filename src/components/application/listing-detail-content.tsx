"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronLeft, DollarSign, ExternalLink, Home, MapPin } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { PaginationButtonGroup } from "@/components/application/pagination/pagination";
import { PropertyDetailLayout } from "@/components/application/property-detail-layout";
import {
    EMPTY_ZILLOW_RAW_DETAILS,
    type ZillowRawDetails,
    extractZillowBuildingDetails,
    extractZillowRawDetails,
    formatLaundryLabel,
    formatScoreLabel,
    formatZillowLabel,
    hasZillowPropertyDetails,
} from "@/components/application/zillow-detail-utils";
import { Button } from "@/components/ui/button";
import {
    type Listing,
    type LoopnetListing,
    type UnitRow,
    type ZillowListing,
    buildUnitTypeSummary,
    getHeroImageUrls,
    getListingDisplayAddress,
    getPropertyTypeLabel,
    shouldShowZillowPropertySection,
} from "@/lib/listings/listing-detail";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

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
    const [units, setUnits] = useState<UnitRow[] | null>(null);
    const [unitsPage, setUnitsPage] = useState(1);
    const [heroImages, setHeroImages] = useState<string[] | null>(null);
    const [heroIndex, setHeroIndex] = useState(0);
    const [offMarketDate, setOffMarketDate] = useState<string | null>(null);
    const [zillowRawDetails, setZillowRawDetails] = useState<ZillowRawDetails | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);

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
                const buildingZpid = row.is_building ? (row.zpid as string | null) : (row.building_zpid as string | null);
                if (buildingZpid) {
                    const unitRes = await fetch(`/api/listings/cleaned?building_zpid=${encodeURIComponent(buildingZpid)}`);
                    const unitData = unitRes.ok ? await unitRes.json() : null;
                    setUnits(unitData ?? null);
                }
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

    useEffect(() => {
        if (!listing) return;
        async function checkOffMarket() {
            if (listing!.source === "zillow") {
                const zpid = (listing as ZillowListing).zpid;
                if (!zpid) return;
                const latestRunRes = await fetch("/api/listings/cleaned?latest_run_id=1");
                if (!latestRunRes.ok) return;
                const { run_id: latestRunId } = await latestRunRes.json();
                if (!latestRunId) return;
                const countRes = await fetch(`/api/listings/cleaned?zpid=${encodeURIComponent(zpid)}&run_id=${encodeURIComponent(latestRunId)}&count_only=1`);
                if (!countRes.ok) return;
                const { count } = await countRes.json();
                if (count === 0) {
                    const lastSeenRes = await fetch(`/api/listings/cleaned?zpid=${encodeURIComponent(zpid)}&latest_scraped_at=1`);
                    if (lastSeenRes.ok) {
                        const { scraped_at } = await lastSeenRes.json();
                        if (scraped_at) setOffMarketDate(scraped_at);
                    }
                }
            } else {
                const latestRunRes = await fetch("/api/listings/loopnet?latest_run_id=1");
                if (!latestRunRes.ok) return;
                const { run_id: latestRunId } = await latestRunRes.json();
                if (!latestRunId) return;
                if ((listing as LoopnetListing).source === "loopnet") {
                    const listingRunId = (listing as unknown as Record<string, unknown>).run_id;
                    if (listingRunId != null && listingRunId !== latestRunId) {
                        const createdAt = (listing as LoopnetListing).created_at;
                        if (createdAt) setOffMarketDate(createdAt);
                    }
                }
            }
        }
        checkOffMarket();
    }, [listing]);

    useEffect(() => {
        async function loadHeroImages() {
            if (!listing || listing.source !== "zillow") return;
            if (!listing.zpid && !listing.building_zpid) return;
            if (!listing.address_zip) return;

            const res = await fetch(`/api/listings/raw-zillow-scrapes?zip_code=${encodeURIComponent(listing.address_zip)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data || data.length === 0) return;

            const raw = (data[0] as any).raw_json;
            if (!raw) return;

            const targetZpid = listing.zpid ?? listing.building_zpid;
            const urls = getHeroImageUrls(raw, targetZpid);
            if (urls.length > 0) {
                setHeroImages(urls);
                setHeroIndex(0);
            }
        }

        loadHeroImages();
    }, [listing]);

    useEffect(() => {
        if (!listing || listing.source !== "zillow") {
            setZillowRawDetails(null);
            return;
        }
        const zillowListing = listing;

        let cancelled = false;

        async function loadZillowRawDetails() {
            const nextDetails: ZillowRawDetails = {
                ...EMPTY_ZILLOW_RAW_DETAILS,
            };

            if (zillowListing.raw_scrape_id) {
                const res = await fetch(`/api/listings/raw-zillow-scrapes?id=${encodeURIComponent(zillowListing.raw_scrape_id)}`);
                const json = res.ok ? await res.json() : null;
                const raw = json?.raw_json ?? null;
                const targetZpid = zillowListing.zpid ?? zillowListing.building_zpid;
                const rawItems = Array.isArray(raw) ? raw : raw ? [raw] : [];
                const matchingItem = rawItems.find((item) => String((item as { zpid?: unknown })?.zpid ?? "") === String(targetZpid ?? ""));
                if (matchingItem) {
                    Object.assign(nextDetails, extractZillowRawDetails(matchingItem));
                }
            }

            const buildingZpid = zillowListing.is_building ? zillowListing.zpid : zillowListing.building_zpid;
            if (buildingZpid) {
                const res = await fetch(`/api/listings/raw-building-details?building_zpid=${encodeURIComponent(buildingZpid)}`);
                const data = res.ok ? await res.json() : [];
                const raw = data?.[0] ? (data[0] as { raw_json?: unknown }).raw_json : null;
                const detailItem = Array.isArray(raw) ? raw[0] : raw;
                if (detailItem) {
                    Object.assign(nextDetails, extractZillowBuildingDetails(detailItem));
                }
            }

            if (!cancelled) {
                setZillowRawDetails(hasZillowPropertyDetails(nextDetails) ? nextDetails : null);
            }
        }

        loadZillowRawDetails();

        return () => {
            cancelled = true;
        };
    }, [listing]);

    useEffect(() => {
        if (!listing || listing.source !== "zillow") return;
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
            new mapboxgl.Marker({ color: "#3b82f6" }).setLngLat([lng, lat]).addTo(map);
        });

        mapInstance.current = map;
        return () => {
            mapInstance.current?.remove();
            mapInstance.current = null;
        };
    }, [listing]);

    const unitTypeSummary = useMemo(() => {
        return buildUnitTypeSummary(units ?? []);
    }, [units]);

    if (listing === undefined) return <LoadingSkeleton />;
    if (listing === null) return <NotFound backHref={backHref} />;

    const displayAddress = getListingDisplayAddress(listing);

    const sourceLabel = listing.source === "zillow" ? "Zillow Rental" : "LoopNet Sale";
    const sourceBadgeClass =
        listing.source === "zillow"
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";
    const buildingName = listing.source === "zillow" ? zillowRawDetails?.buildingName : null;
    const statusText = listing.source === "zillow" ? zillowRawDetails?.statusText : null;
    const showStatus = Boolean(statusText && statusText !== buildingName);
    const availabilityCount = listing.source === "zillow" ? zillowRawDetails?.availabilityCount : null;
    const formattedLaundry = listing.source === "zillow" ? formatLaundryLabel(listing.laundry) : null;
    const zillowPropertySectionTitle = listing.source === "zillow" && listing.building_zpid ? "Building Details" : "Property Details";
    const showZillowPropertySection = listing.source === "zillow" && shouldShowZillowPropertySection(zillowRawDetails);
    const propertyTypeLabel = listing.source === "zillow" ? getPropertyTypeLabel(listing.is_building, listing.building_zpid) : null;

    const baseHeroFallback = (
        <div className="flex aspect-[3/1] min-h-[160px] items-center justify-center bg-gray-200 dark:bg-gray-700">
            <Building2 className="size-16 text-gray-400 dark:text-gray-500" />
        </div>
    );

    const hero =
        listing.source === "loopnet" ? (
            listing.thumbnail_url ? (
                <div className="aspect-[3/1] min-h-[180px] overflow-hidden">
                    <img src={listing.thumbnail_url} alt="" className="h-full w-full object-cover" />
                </div>
            ) : (
                baseHeroFallback
            )
        ) : listing.source === "zillow" && heroImages && heroImages.length > 0 ? (
            <div className="relative aspect-[3/1] min-h-[180px] overflow-hidden bg-black">
                <img src={heroImages[heroIndex]} alt="" className="h-full w-full object-cover" />
                {heroImages.length > 1 && (
                    <>
                        <button
                            type="button"
                            className="absolute top-1/2 left-3 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 px-2 py-1 text-xs text-white"
                            onClick={() => setHeroIndex((prev) => (prev === 0 ? heroImages.length - 1 : prev - 1))}
                        >
                            ‹
                        </button>
                        <button
                            type="button"
                            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 px-2 py-1 text-xs text-white"
                            onClick={() => setHeroIndex((prev) => (prev === heroImages.length - 1 ? 0 : prev + 1))}
                        >
                            ›
                        </button>
                        <div className="absolute right-4 bottom-3 rounded-full bg-black/40 px-2 py-1 text-xs text-white">
                            {heroIndex + 1} / {heroImages.length}
                        </div>
                    </>
                )}
            </div>
        ) : listing.source === "zillow" && listing.img_src ? (
            <div className="aspect-[3/1] min-h-[180px] overflow-hidden">
                <img src={listing.img_src} alt="" className="h-full w-full object-cover" />
            </div>
        ) : (
            baseHeroFallback
        );

    return (
        <PropertyDetailLayout
            backHref={backHref}
            title={displayAddress}
            subtitle={
                <>
                    <MapPin className="size-3.5" />
                    {listing.source === "zillow" ? [listing.address_city, listing.address_state].filter(Boolean).join(", ") : listing.location || ""}
                </>
            }
            headerBadge={
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", sourceBadgeClass)}>{sourceLabel}</span>
                    {listing.source === "zillow" && listing.building_zpid && !listing.is_building && (
                        <Link
                            href={`/analytics/building/${encodeURIComponent(listing.building_zpid)}`}
                            className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline dark:text-violet-400"
                        >
                            <Building2 className="size-3.5" />
                            View Building
                        </Link>
                    )}
                    {listing.source === "zillow" && (listing.detail_url || listing.zpid) && (
                        <a
                            href={listing.detail_url ?? `https://www.zillow.com/homedetails/${listing.zpid}_zpid/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                            View on Zillow
                            <ExternalLink className="size-3.5" />
                        </a>
                    )}
                    {listing.source === "loopnet" && listing.cap_rate && (
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
                    {listing.source === "zillow" ? (
                        <>
                            {listing.is_building && units && units.length > 0 ? (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Units</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                                        {unitTypeSummary.length} type{unitTypeSummary.length !== 1 ? "s" : ""} · {units.length} total
                                    </dd>
                                </div>
                            ) : (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Monthly Rent</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                                        {listing.price ? `$${listing.price.toLocaleString()}/mo` : "—"}
                                    </dd>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">Beds</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.beds ?? 0}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">Baths</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.baths ? Number(listing.baths).toFixed(1) : "—"}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">Sq Ft</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.area ? listing.area.toLocaleString() : "—"}</dd>
                            </div>
                            {listing.home_type && (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Home Type</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">{formatZillowLabel(listing.home_type)}</dd>
                                </div>
                            )}
                            {buildingName && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Building</dt>
                                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{buildingName}</dd>
                                </div>
                            )}
                            {showStatus && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{statusText}</dd>
                                </div>
                            )}
                            {availabilityCount != null && (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Available Units</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">{availabilityCount}</dd>
                                </div>
                            )}
                            {formattedLaundry && (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Laundry</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">{formattedLaundry}</dd>
                                </div>
                            )}
                            {listing.availability_date && (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Available</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                                        {new Date(listing.availability_date).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </dd>
                                </div>
                            )}
                            {propertyTypeLabel && (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Property Type</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">{propertyTypeLabel}</dd>
                                </div>
                            )}
                            {listing.scraped_at && (
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Listed on</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                                        {new Date(listing.scraped_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                        </>
                    ) : (
                        <>
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
                        </>
                    )}
                </dl>
            </section>

            {/* Map */}
            {listing.source === "zillow" && listing.latitude && listing.longitude && (
                <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                        <MapPin className="size-4 text-gray-500" />
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Location</h3>
                    </div>
                    <div ref={mapContainerRef} className="h-full min-h-48 w-full" />
                </section>
            )}

            {/* Unit Mix */}
            {listing.source === "zillow" && units && units.length > 0 && (
                <section className="rounded-xl border border-gray-200 bg-white p-5 md:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                        <Building2 className="size-4" />
                        Unit Mix
                        <span className="text-sm font-normal text-gray-500">
                            ({units.length} unit{units.length !== 1 ? "s" : ""})
                        </span>
                    </h3>
                    <div className="mb-6 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/30">
                                    <th className="px-3 py-2 text-left text-xs font-semibold tracking-wider text-gray-500 uppercase">Type</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Units</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Avg Rent</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Range</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Avg Sq Ft</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Avg $/sqft</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unitTypeSummary.map((row) => (
                                    <tr key={`${row.beds}-${row.baths}`} className="border-b border-gray-50 dark:border-gray-700/50">
                                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                                            {row.beds} bd · {row.baths != null ? Number(row.baths).toFixed(1) : "?"} ba
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{row.count}</td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                            {row.avgPrice ? `$${Math.round(row.avgPrice).toLocaleString()}` : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                            {row.minPrice != null && row.maxPrice != null
                                                ? `$${Math.round(row.minPrice).toLocaleString()} – $${Math.round(row.maxPrice).toLocaleString()}`
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                            {row.avgArea ? Math.round(row.avgArea).toLocaleString() : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                            {row.avgPrice && row.avgArea ? `$${(row.avgPrice / row.avgArea).toFixed(2)}` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">All Units</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/30">
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Rent/mo</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Beds</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Baths</th>
                                    <th className="px-3 py-2 text-right text-xs font-semibold tracking-wider text-gray-500 uppercase">Sq Ft</th>
                                </tr>
                            </thead>
                            <tbody>
                                {units.slice((unitsPage - 1) * 25, unitsPage * 25).map((unit) => (
                                    <tr
                                        key={unit.id}
                                        className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30"
                                    >
                                        <td className="px-3 py-2 text-right font-medium">
                                            <Link href={`/analytics/listing/zillow-${unit.id}`} className="text-blue-600 hover:underline dark:text-blue-400">
                                                {unit.price ? `$${unit.price.toLocaleString()}` : "—"}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{unit.beds ?? 0}</td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                            {unit.baths != null ? Number(unit.baths).toFixed(1) : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{unit.area?.toLocaleString() ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {units.length > 25 && (
                        <PaginationButtonGroup page={unitsPage} total={Math.ceil(units.length / 25)} onPageChange={setUnitsPage} align="center" />
                    )}
                </section>
            )}

            {showZillowPropertySection && (
                <section className="rounded-xl border border-gray-200 bg-white p-5 md:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                        <Building2 className="size-4" />
                        {zillowPropertySectionTitle}
                    </h3>

                    <div className="grid gap-6 md:grid-cols-2">
                        <dl className="space-y-3 text-sm">
                            {zillowRawDetails?.neighborhood && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Neighborhood</dt>
                                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{zillowRawDetails.neighborhood}</dd>
                                </div>
                            )}
                            {zillowRawDetails?.county && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">County</dt>
                                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{zillowRawDetails.county}</dd>
                                </div>
                            )}
                            {zillowRawDetails?.walkScore && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Walk Score</dt>
                                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatScoreLabel(zillowRawDetails.walkScore)}</dd>
                                </div>
                            )}
                            {zillowRawDetails?.transitScore && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Transit Score</dt>
                                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                                        {formatScoreLabel(zillowRawDetails.transitScore)}
                                    </dd>
                                </div>
                            )}
                            {zillowRawDetails?.bikeScore && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500 dark:text-gray-400">Bike Score</dt>
                                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{formatScoreLabel(zillowRawDetails.bikeScore)}</dd>
                                </div>
                            )}
                        </dl>

                        {zillowRawDetails?.commonUnitAmenities.length ? (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Amenities</h4>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {zillowRawDetails.commonUnitAmenities.map((amenity) => (
                                        <span
                                            key={amenity}
                                            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700/50 dark:text-gray-200"
                                        >
                                            {amenity}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {zillowRawDetails?.specialOffer && (
                        <div className="mt-6 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
                            <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">Special offer</p>
                            <p className="mt-1 text-sm text-blue-900 dark:text-blue-100">{zillowRawDetails.specialOffer}</p>
                        </div>
                    )}

                    {zillowRawDetails?.description && (
                        <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Description</h4>
                            <p className="mt-2 text-sm leading-6 whitespace-pre-line text-gray-600 dark:text-gray-300">{zillowRawDetails.description}</p>
                        </div>
                    )}
                </section>
            )}

            {/* Listing Details (loopnet only) */}
            {listing.source === "loopnet" && (
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
                    </dl>
                </section>
            )}
        </PropertyDetailLayout>
    );
}
