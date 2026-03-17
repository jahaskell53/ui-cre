"use client";

import { useState, useEffect, useRef } from "react";
import { TrendingUp, MapPin, Search, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/utils/supabase";
import { TrendRow, ActivityRow, buildChartData, BED_KEYS, pctChange, formatDollars } from "./trends-utils";
import { RentTrendsSection } from "./rent-trends-section";
import { MarketActivitySection } from "./market-activity-section";

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

interface MapboxFeature {
    id: string;
    text: string;
    place_name: string;
    center: [number, number];
    context?: Array<{ id: string; text: string }>;
}

const BED_OPTIONS = [
    { beds: 0, label: "Studio" },
    { beds: 1, label: "1BR" },
    { beds: 2, label: "2BR" },
    { beds: 3, label: "3BR" },
];

const AREA_TYPES = ["Address", "ZIP Code", "Neighborhood", "City", "County", "MSA"];
const ENABLED_AREA_TYPES = new Set(["Address", "ZIP Code"]);

export default function TrendsPage() {
    const [address, setAddress] = useState("");
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedZip, setSelectedZip] = useState<string | null>(null);
    const [areaType, setAreaType] = useState<string>("Address");

    const [selectedBeds, setSelectedBeds] = useState<number>(1);
    const [reitsOnly, setReitsOnly] = useState(false);
    const [trendData, setTrendData] = useState<TrendRow[] | null>(null);
    const [activityData, setActivityData] = useState<ActivityRow[] | null>(null);
    const [loading, setLoading] = useState(false);

    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const userCoordsRef = useRef<{ lng: number; lat: number } | null>(null);

    // Get user location once for proximity bias
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => { userCoordsRef.current = { lng: pos.coords.longitude, lat: pos.coords.latitude }; },
            () => { /* permission denied or unavailable — no proximity bias */ }
        );
    }, []);

    // Autocomplete
    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        if (address.length < 3) { setSuggestions([]); return; }
        suggestTimerRef.current = setTimeout(async () => {
            try {
                const types = areaType === "ZIP Code" ? "postcode" : "address";
                const proximity = userCoordsRef.current
                    ? `&proximity=${userCoordsRef.current.lng},${userCoordsRef.current.lat}`
                    : "";
                const res = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&types=${types}&country=US${proximity}`
                );
                const data = await res.json();
                setSuggestions((data.features ?? []) as MapboxFeature[]);
                setShowSuggestions(true);
            } catch {
                setSuggestions([]);
            }
        }, 250);
    }, [address, areaType]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Fetch when any filter changes
    useEffect(() => {
        if (!selectedZip) { setTrendData(null); setActivityData(null); return; }
        setLoading(true);
        Promise.all([
            supabase
                .rpc("get_rent_trends", { p_zip: selectedZip, p_beds: selectedBeds, p_reits_only: reitsOnly })
                .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as TrendRow[]; }),
            supabase
                .rpc("get_market_activity", { p_zip: selectedZip, p_reits_only: reitsOnly })
                .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as ActivityRow[]; }),
        ]).then(([trends, activity]) => {
            setLoading(false);
            if (trends !== null) setTrendData(trends);
            if (activity !== null) setActivityData(activity);
        });
    }, [selectedZip, selectedBeds, reitsOnly]);

    const selectSuggestion = (feature: MapboxFeature) => {
        setAddress(feature.place_name);
        setSuggestions([]);
        setShowSuggestions(false);
        const postcodeCtx = feature.context?.find(c => c.id.startsWith("postcode."))?.text;
        const zip = feature.id.startsWith("postcode") ? feature.text : (postcodeCtx ?? null);
        if (zip) { setSelectedZip(zip); }
        else { setSelectedZip(null); }
    };

    const chartData = trendData ? buildChartData(trendData) : [];

    const bed = BED_KEYS.find(b => b.beds === selectedBeds)!;
    const weeks = chartData.filter(p => p[bed.key] != null);
    const latestRent = weeks.length > 0 ? weeks[weeks.length - 1][bed.key] : undefined;
    const firstRent = weeks.length > 0 ? weeks[0][bed.key] : undefined;
    const rentChange = weeks.length >= 2 ? pctChange(firstRent, latestRent) : null;

    const segmentToggle = (label: string, active: boolean, onClick: () => void, first = false) => (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 whitespace-nowrap transition-colors text-sm ${first ? '' : 'border-l border-gray-200 dark:border-gray-600'} ${active ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex-1 p-6 overflow-auto max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="size-5 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Rent Trends</h1>
            </div>

            {/* Filter panel */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6 space-y-4">
                {/* Area type */}
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24 shrink-0">Area type</span>
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
                        {AREA_TYPES.map((t, i) => {
                            const enabled = ENABLED_AREA_TYPES.has(t);
                            const active = areaType === t;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    disabled={!enabled}
                                    onClick={() => { if (enabled) { setAreaType(t); setAddress(""); setSelectedZip(null); setSuggestions([]); } }}
                                    className={`px-3 py-1.5 whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200 dark:border-gray-600' : ''} ${active ? 'bg-blue-600 text-white' : enabled ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
                                >
                                    {t}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Area search */}
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24 shrink-0">Area</span>
                    <div className="flex-1 relative" ref={inputWrapperRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10 pointer-events-none" />
                        <Input
                            placeholder={areaType === "ZIP Code" ? "Enter zip code…" : "Enter address…"}
                            value={address}
                            onChange={(e) => { setAddress(e.target.value); setSelectedZip(null); }}
                            onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestions(false); }}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            className="pl-9"
                            autoComplete="off"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                                {suggestions.map((feature) => (
                                    <li key={feature.id}>
                                        <button
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); selectSuggestion(feature); }}
                                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-start gap-2 transition-colors"
                                        >
                                            <MapPin className="size-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-gray-800 dark:text-gray-200 leading-snug">{feature.place_name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Bedrooms */}
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24 shrink-0">Bedrooms</span>
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
                        {BED_OPTIONS.map((opt, i) => segmentToggle(opt.label, selectedBeds === opt.beds, () => setSelectedBeds(opt.beds), i === 0))}
                    </div>
                </div>

                {/* Segment */}
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24 shrink-0">Segment</span>
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
                        {segmentToggle("Mid-market", !reitsOnly, () => setReitsOnly(false), true)}
                        {segmentToggle("REIT", reitsOnly, () => setReitsOnly(true))}
                    </div>
                </div>
            </div>

            {/* Empty state */}
            {!selectedZip && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="size-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">Enter a zip code above to see rent trends</p>
                </div>
            )}

            {/* Loading */}
            {selectedZip && loading && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex items-center justify-center">
                    <p className="text-gray-400 text-sm">Loading…</p>
                </div>
            )}

            {/* No data */}
            {selectedZip && !loading && trendData && trendData.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="size-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No data for this zip code and bedroom type</p>
                </div>
            )}

            {/* Grid dashboard */}
            {selectedZip && !loading && chartData.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                    {/* Stat tile */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-6">
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: bed.color }} />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Median Rent</span>
                            </div>
                            {latestRent != null ? (
                                <>
                                    <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatDollars(latestRent)}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{bed.label} · latest week</p>
                                    {rentChange != null && (
                                        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${rentChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            {rentChange >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                                            {Math.abs(rentChange).toFixed(1)}% over period
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-2xl font-semibold text-gray-400">—</p>
                            )}
                        </div>
                        {activityData && activityData.length > 0 && (() => {
                            const latestWeek = activityData
                                .filter(r => r.beds === selectedBeds)
                                .reduce((max, r) => r.week_start > max ? r.week_start : max, "");
                            const row = activityData.find(r => r.beds === selectedBeds && r.week_start === latestWeek);
                            return row ? (
                                <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                                    <div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{row.accumulated_listings.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">accumulated listings</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{row.new_listings.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">new last week</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{row.closed_listings.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">closed last week</p>
                                    </div>
                                </div>
                            ) : null;
                        })()}
                    </div>

                    {/* Rent chart */}
                    <div className="col-span-3">
                        <RentTrendsSection chartData={chartData} selectedBeds={selectedBeds} />
                    </div>

                    {/* Activity chart */}
                    {activityData && activityData.length > 0 && (
                        <div className="col-span-4 mb-8">
                            <MarketActivitySection activityData={activityData} selectedBeds={selectedBeds} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
