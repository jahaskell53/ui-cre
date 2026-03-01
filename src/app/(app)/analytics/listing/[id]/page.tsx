"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    Building2,
    ChevronLeft,
    DollarSign,
    MapPin,
    Calculator,
    Home,
    Layers,
    ExternalLink,
    Flame,
    Wind,
    Waves,
    Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IrrProjectionChart } from "@/components/application/irr-projection-chart";
import { PropertyDetailLayout } from "@/components/application/property-detail-layout";
import { ValuationCard } from "@/components/application/valuation-card";
import { supabase } from "@/utils/supabase";
import { cn } from "@/lib/utils";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

interface ZillowListing {
    source: "zillow";
    id: string;
    zpid: string | null;
    img_src: string | null;
    detail_url: string | null;
    address_raw: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    area: number | null;
    availability_date: string | null;
    has_fireplace: boolean | null;
    has_ac: boolean | null;
    has_spa: boolean | null;
    has_pool: boolean | null;
    scraped_at: string | null;
    latitude: number | null;
    longitude: number | null;
    is_building: boolean | null;
    building_zpid: string | null;
}

interface LoopnetListing {
    source: "loopnet";
    id: string;
    address: string | null;
    headline: string | null;
    location: string | null;
    price: string | null;
    cap_rate: string | null;
    building_category: string | null;
    square_footage: string | null;
    thumbnail_url: string | null;
    listing_url: string | null;
    created_at: string | null;
}

type Listing = ZillowListing | LoopnetListing;

function LoadingSkeleton() {
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-auto">
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="mt-4 h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="mt-2 h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="aspect-[3/1] min-h-[160px] bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
                        <div className="space-y-3">
                            {[0, 1, 2].map((j) => (
                                <div key={j} className="flex justify-between">
                                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function NotFound() {
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            <div className="p-6">
                <Link
                    href="/analytics"
                    className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
                >
                    <ChevronLeft className="size-4" />
                    Back to Analytics
                </Link>
                <div className="mt-8 text-center py-12">
                    <Building2 className="size-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Listing not found</h2>
                    <p className="text-sm text-gray-500 mt-1">This listing may have been removed or the link is invalid.</p>
                    <Button variant="outline" className="mt-4" asChild>
                        <Link href="/analytics">Back to Analytics</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function ListingDetailPage() {
    const params = useParams();
    const rawId = params.id as string;

    const [listing, setListing] = useState<Listing | null | undefined>(undefined); // undefined = loading
    const [capRate, setCapRate] = useState(4.5);
    const [rent, setRent] = useState(3000);
    const [vacancy, setVacancy] = useState(5);
    const [units, setUnits] = useState(1);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        if (!rawId) return;

        async function load() {
            if (rawId.startsWith("zillow-")) {
                const uuid = rawId.slice("zillow-".length);
                const { data, error } = await supabase
                    .from("cleaned_listings")
                    .select("id, zpid, img_src, detail_url, address_raw, address_street, address_city, address_state, address_zip, price, beds, baths, area, availability_date, has_fireplace, has_ac, has_spa, has_pool, scraped_at, latitude, longitude, is_building, building_zpid")
                    .eq("id", uuid)
                    .single();
                if (error || !data) {
                    setListing(null);
                    return;
                }
                const row = data as Record<string, unknown>;
                setListing({ source: "zillow", ...row } as ZillowListing);
                if (row.price) {
                    setRent(row.price as number);
                }
            } else {
                const { data, error } = await supabase
                    .from("loopnet_listings")
                    .select("id, address, headline, location, price, cap_rate, building_category, square_footage, thumbnail_url, listing_url, created_at")
                    .eq("id", rawId)
                    .single();
                if (error || !data) {
                    setListing(null);
                    return;
                }
                const row = data as Record<string, unknown>;
                setListing({ source: "loopnet", ...row } as LoopnetListing);
                if (row.cap_rate) {
                    const parsed = parseFloat(String(row.cap_rate).replace(/[^0-9.]/g, ""));
                    if (!isNaN(parsed)) setCapRate(parsed);
                }
            }
        }

        load();
    }, [rawId]);

    useEffect(() => {
        if (!listing || listing.source !== "zillow") return;
        const { latitude: lat, longitude: lng } = listing;
        if (!lat || !lng || !mapContainerRef.current || mapInstance.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [lng, lat],
            zoom: 14,
            accessToken: MAPBOX_TOKEN,
            interactive: false,
            attributionControl: false,
        });

        map.on('load', () => {
            new mapboxgl.Marker({ color: '#3b82f6' }).setLngLat([lng, lat]).addTo(map);
        });

        mapInstance.current = map;
        return () => { mapInstance.current?.remove(); mapInstance.current = null; };
    }, [listing]);

    const annualRent = rent * units * 12 * (1 - vacancy / 100);
    const estimatedValue = Math.round(annualRent / (capRate / 100));
    const irr = 12.1;

    if (listing === undefined) return <LoadingSkeleton />;
    if (listing === null) return <NotFound />;

    const displayAddress =
        listing.source === "zillow"
            ? listing.address_raw ||
              [listing.address_street, listing.address_city, listing.address_state, listing.address_zip].filter(Boolean).join(", ") ||
              "Address not listed"
            : listing.address || listing.headline || "Address not listed";

    const sourceLabel = listing.source === "zillow" ? "Zillow Rental" : "LoopNet Sale";
    const sourceBadgeClass =
        listing.source === "zillow"
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";

    const heroImageUrl =
        listing.source === "loopnet" ? listing.thumbnail_url :
        listing.source === "zillow" ? listing.img_src : null;

    const hero = heroImageUrl ? (
        <div className="aspect-[3/1] min-h-[180px] overflow-hidden">
            <img src={heroImageUrl} alt="" className="w-full h-full object-cover" />
        </div>
    ) : (
        <div className="aspect-[3/1] min-h-[160px] bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Building2 className="size-16 text-gray-400 dark:text-gray-500" />
        </div>
    );

    return (
        <PropertyDetailLayout
            backHref="/analytics"
            title={displayAddress}
            subtitle={
                <>
                    <MapPin className="size-3.5" />
                    {listing.source === "zillow"
                        ? [listing.address_city, listing.address_state].filter(Boolean).join(", ")
                        : listing.location || ""}
                </>
            }
            headerBadge={
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", sourceBadgeClass)}>
                        {sourceLabel}
                    </span>
                    {listing.source === "zillow" && (listing.detail_url || listing.zpid) && (
                        <a
                            href={listing.detail_url ?? `https://www.zillow.com/homedetails/${listing.zpid}_zpid/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            View on Zillow
                            <ExternalLink className="size-3.5" />
                        </a>
                    )}
                    {listing.source === "loopnet" && listing.cap_rate && (
                        <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{listing.cap_rate}</span>
                            <span className="text-xs text-gray-500 ml-1">Cap Rate</span>
                        </div>
                    )}
                </div>
            }
            hero={hero}
        >
                    {/* Overview */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <Home className="size-4" />
                            Overview
                        </h3>
                        <dl className="space-y-3 text-sm">
                            {listing.source === "zillow" ? (
                                <>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500 dark:text-gray-400">Monthly Rent</dt>
                                        <dd className="font-medium text-gray-900 dark:text-gray-100">
                                            {listing.price ? `$${listing.price.toLocaleString()}/mo` : "—"}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500 dark:text-gray-400">Beds</dt>
                                        <dd className="font-medium text-gray-900 dark:text-gray-100">{listing.beds ?? "—"}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500 dark:text-gray-400">Baths</dt>
                                        <dd className="font-medium text-gray-900 dark:text-gray-100">
                                            {listing.baths ? Number(listing.baths).toFixed(1) : "—"}
                                        </dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500 dark:text-gray-400">Sq Ft</dt>
                                        <dd className="font-medium text-gray-900 dark:text-gray-100">
                                            {listing.area ? listing.area.toLocaleString() : "—"}
                                        </dd>
                                    </div>
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
                                    {(listing.is_building !== null || listing.building_zpid) && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500 dark:text-gray-400">Property Type</dt>
                                            <dd className="font-medium text-gray-900 dark:text-gray-100">
                                                {listing.is_building ? "Whole Building" : listing.building_zpid ? "Unit in Building" : "Single Unit"}
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
                                </>
                            )}
                        </dl>
                    </section>

                    {/* Amenities (zillow only) or Actions (loopnet) */}
                    {listing.source === "zillow" ? (
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                                <Layers className="size-4" />
                                Amenities
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { key: "has_fireplace", label: "Fireplace", icon: Flame, value: listing.has_fireplace },
                                    { key: "has_ac", label: "A/C", icon: Wind, value: listing.has_ac },
                                    { key: "has_pool", label: "Pool", icon: Waves, value: listing.has_pool },
                                    { key: "has_spa", label: "Spa", icon: Sparkles, value: listing.has_spa },
                                ].map(({ key, label, icon: Icon, value }) => (
                                    <div
                                        key={key}
                                        className={cn(
                                            "flex items-center gap-2 p-2.5 rounded-lg text-sm",
                                            value
                                                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                                : "bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500"
                                        )}
                                    >
                                        <Icon className="size-4 flex-shrink-0" />
                                        <span className={value ? "font-medium" : ""}>{label}</span>
                                        {!value && <span className="ml-auto text-xs">—</span>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                                <DollarSign className="size-4" />
                                Listing Details
                            </h3>
                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Headline</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100 text-right max-w-[180px]">
                                        {listing.headline || "—"}
                                    </dd>
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
                                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            View on LoopNet
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    </div>
                                )}
                            </dl>
                        </section>
                    )}

                    {/* Map */}
                    {listing.source === "zillow" && listing.latitude && listing.longitude && (
                        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden md:col-span-2">
                            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                <MapPin className="size-4 text-gray-500" />
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Location</h3>
                            </div>
                            <div ref={mapContainerRef} className="h-64 w-full" />
                        </section>
                    )}

                    {/* Evaluation */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:col-span-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <Calculator className="size-4" />
                            Evaluation
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ValuationCard
                                title="Estimated Value"
                                value={estimatedValue}
                                irr={irr}
                                noi={Math.round(annualRent)}
                                compact
                            />
                            <div className="space-y-5">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <Label className="text-sm">Cap Rate</Label>
                                        <span className="text-sm font-semibold">{capRate}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="0.1"
                                        value={capRate}
                                        onChange={(e) => setCapRate(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <Label className="text-sm">Monthly Rent</Label>
                                        <span className="text-sm font-semibold">${rent.toLocaleString()}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="500"
                                        max="15000"
                                        step="100"
                                        value={rent}
                                        onChange={(e) => setRent(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <Label className="text-sm">Vacancy Rate</Label>
                                        <span className="text-sm font-semibold">{vacancy}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="20"
                                        step="1"
                                        value={vacancy}
                                        onChange={(e) => setVacancy(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <Label className="text-sm">Units</Label>
                                        <span className="text-sm font-semibold">{units}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        step="1"
                                        value={units}
                                        onChange={(e) => setUnits(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
                            <IrrProjectionChart currentIrr={irr} years={5} height={180} />
                        </div>
                    </section>
        </PropertyDetailLayout>
    );
}
