"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ExternalLink, Home, MapPin } from "lucide-react";
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
import {
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

const UNITS_PAGE_SIZE = 10;

function UnitMixUnitsLoadingSkeleton() {
    const summaryCols = 6;
    const detailCols = 4;
    return (
        <>
            <div className="mb-6 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/30">
                            {Array.from({ length: summaryCols }, (_, i) => (
                                <th key={i} className={`px-3 py-2 ${i === 0 ? "text-left" : "text-right"}`}>
                                    <div className={`h-3 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-600 ${i === 0 ? "w-14" : "ml-auto w-14"}`} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[0, 1, 2].map((row) => (
                            <tr key={row} className="border-b border-gray-50 dark:border-gray-700/50">
                                {Array.from({ length: summaryCols }, (_, col) => (
                                    <td key={col} className={`px-3 py-2 ${col === 0 ? "text-left" : "text-right"}`}>
                                        <div
                                            className={`h-3 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-600 ${col === 0 ? "w-28" : "ml-auto w-12"}`}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mb-3 h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/30">
                            {Array.from({ length: detailCols }, (_, i) => (
                                <th key={i} className="px-3 py-2 text-right">
                                    <div className="ml-auto h-3 w-14 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[0, 1, 2, 3, 4].map((row) => (
                            <tr key={row} className="border-b border-gray-50 dark:border-gray-700/50">
                                {Array.from({ length: detailCols }, (_, col) => (
                                    <td key={col} className="px-3 py-2 text-right">
                                        <div className="ml-auto h-3 w-16 max-w-full animate-pulse rounded bg-gray-200 dark:bg-gray-600" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

export function ZillowListingDetail({ listing, backHref }: { listing: ZillowListing; backHref?: string }) {
    const [buildingZpid, setBuildingZpid] = useState<string | null>(null);
    const [units, setUnits] = useState<UnitRow[] | null>(null);
    const [unitsLatestOnly, setUnitsLatestOnly] = useState(true);
    const [unitsPage, setUnitsPage] = useState(1);
    const [heroImages, setHeroImages] = useState<string[] | null>(null);
    const [heroIndex, setHeroIndex] = useState(0);
    const [offMarketDate, setOffMarketDate] = useState<string | null>(null);
    const [zillowRawDetails, setZillowRawDetails] = useState<ZillowRawDetails | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        const zpid = listing.is_building ? (listing.zpid as string | null) : (listing.building_zpid as string | null);
        setBuildingZpid(zpid ?? null);
    }, [listing]);

    useEffect(() => {
        if (!buildingZpid) return;
        setUnits(null);
        const param = unitsLatestOnly ? "1" : "0";
        fetch(`/api/listings/cleaned?building_zpid=${encodeURIComponent(buildingZpid)}&latest_only=${param}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => setUnits(data ?? null));
    }, [buildingZpid, unitsLatestOnly]);

    useEffect(() => {
        async function checkOffMarket() {
            const zpid = listing.zpid;
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
        }
        checkOffMarket();
    }, [listing]);

    useEffect(() => {
        async function loadHeroImages() {
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
        let cancelled = false;

        async function loadZillowRawDetails() {
            const nextDetails: ZillowRawDetails = { ...EMPTY_ZILLOW_RAW_DETAILS };

            if (listing.raw_scrape_id) {
                const res = await fetch(`/api/listings/raw-zillow-scrapes?id=${encodeURIComponent(listing.raw_scrape_id)}`);
                const json = res.ok ? await res.json() : null;
                const raw = json?.raw_json ?? null;
                const targetZpid = listing.zpid ?? listing.building_zpid;
                const rawItems = Array.isArray(raw) ? raw : raw ? [raw] : [];
                const matchingItem = rawItems.find((item) => String((item as { zpid?: unknown })?.zpid ?? "") === String(targetZpid ?? ""));
                if (matchingItem) {
                    Object.assign(nextDetails, extractZillowRawDetails(matchingItem));
                }
            }

            const bZpid = listing.is_building ? listing.zpid : listing.building_zpid;
            if (bZpid) {
                const res = await fetch(`/api/listings/raw-building-details?building_zpid=${encodeURIComponent(bZpid)}`);
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

    const unitTypeSummary = useMemo(() => buildUnitTypeSummary(units ?? []), [units]);

    const displayAddress = getListingDisplayAddress(listing);
    const buildingName = zillowRawDetails?.buildingName ?? null;
    const statusText = zillowRawDetails?.statusText ?? null;
    const showStatus = Boolean(statusText && statusText !== buildingName);
    const availabilityCount = zillowRawDetails?.availabilityCount ?? null;
    const formattedLaundry = formatLaundryLabel(listing.laundry);
    const zillowPropertySectionTitle = listing.building_zpid ? "Building Details" : "Property Details";
    const showZillowPropertySection = shouldShowZillowPropertySection(zillowRawDetails);
    const propertyTypeLabel = getPropertyTypeLabel(listing.is_building, listing.building_zpid);

    const baseHeroFallback = (
        <div className="flex aspect-[3/1] min-h-[160px] items-center justify-center bg-gray-200 dark:bg-gray-700">
            <Building2 className="size-16 text-gray-400 dark:text-gray-500" />
        </div>
    );

    const hero =
        heroImages && heroImages.length > 0 ? (
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
        ) : listing.img_src ? (
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
                    {[listing.address_city, listing.address_state].filter(Boolean).join(", ")}
                    {zillowRawDetails?.neighborhood && <span className="text-gray-500 dark:text-gray-400">· {zillowRawDetails.neighborhood}</span>}
                </>
            }
            headerBadge={
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300")}>
                        Zillow Rental
                    </span>
                    {listing.building_zpid && !listing.is_building && (
                        <Link
                            href={`/analytics/building/${encodeURIComponent(listing.building_zpid)}`}
                            className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline dark:text-violet-400"
                        >
                            <Building2 className="size-3.5" />
                            View Building
                        </Link>
                    )}
                    {(listing.detail_url || listing.zpid) && (
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
                    {listing.is_building && buildingZpid ? (
                        <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Units</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">
                                {units ? `${unitTypeSummary.length} type${unitTypeSummary.length !== 1 ? "s" : ""} · ${units.length} total` : "—"}
                            </dd>
                        </div>
                    ) : (
                        <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Monthly Rent</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.price ? `$${listing.price.toLocaleString()}/mo` : "—"}</dd>
                        </div>
                    )}
                    {!listing.is_building && (
                        <>
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
                        </>
                    )}
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

            {/* Property / Building Details */}
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

            {/* Unit Mix */}
            {buildingZpid && (
                <section className="rounded-xl border border-gray-200 bg-white p-5 md:col-span-2 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-4 flex items-center gap-2">
                        <Building2 className="size-4 text-gray-900 dark:text-gray-100" />
                        <h3 className="flex-1 font-semibold text-gray-900 dark:text-gray-100">
                            Unit Mix
                            {units && (
                                <span className="ml-1 text-sm font-normal text-gray-500">
                                    ({units.length} unit{units.length !== 1 ? "s" : ""})
                                </span>
                            )}
                        </h3>
                        <div className="flex overflow-hidden rounded-md border border-gray-200 text-xs dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => {
                                    setUnitsLatestOnly(true);
                                    setUnitsPage(1);
                                }}
                                className={`px-2.5 py-1 transition-colors ${unitsLatestOnly ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}
                            >
                                Current
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setUnitsLatestOnly(false);
                                    setUnitsPage(1);
                                }}
                                className={`border-l border-gray-200 px-2.5 py-1 transition-colors dark:border-gray-700 ${!unitsLatestOnly ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"}`}
                            >
                                Historical
                            </button>
                        </div>
                    </div>
                    {units === null ? (
                        <UnitMixUnitsLoadingSkeleton />
                    ) : units.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No units found.</div>
                    ) : (
                        <>
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
                                        {units.slice((unitsPage - 1) * UNITS_PAGE_SIZE, unitsPage * UNITS_PAGE_SIZE).map((unit) => (
                                            <tr
                                                key={unit.id}
                                                className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30"
                                            >
                                                <td className="px-3 py-2 text-right font-medium">
                                                    <Link
                                                        href={`/analytics/listing/zillow-${unit.id}`}
                                                        className="text-blue-600 hover:underline dark:text-blue-400"
                                                    >
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
                            {units.length > UNITS_PAGE_SIZE && (
                                <PaginationButtonGroup
                                    page={unitsPage}
                                    total={Math.ceil(units.length / UNITS_PAGE_SIZE)}
                                    onPageChange={setUnitsPage}
                                    align="center"
                                />
                            )}
                        </>
                    )}
                </section>
            )}
        </PropertyDetailLayout>
    );
}
