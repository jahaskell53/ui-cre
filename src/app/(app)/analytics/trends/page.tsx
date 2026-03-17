"use client";

import { useState, useEffect, useRef } from "react";
import { TrendingUp, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/utils/supabase";
import { TrendRow, ActivityRow, buildChartData } from "./trends-utils";
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

export default function TrendsPage() {
    const [address, setAddress] = useState("");
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedZip, setSelectedZip] = useState<string | null>(null);
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [trendData, setTrendData] = useState<TrendRow[] | null>(null);
    const [activityData, setActivityData] = useState<ActivityRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [reitsOnly, setReitsOnly] = useState(false);

    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);

    // Autocomplete
    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        if (address.length < 3) { setSuggestions([]); return; }
        suggestTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&types=address,postcode,place&country=US`
                );
                const data = await res.json();
                setSuggestions((data.features ?? []) as MapboxFeature[]);
                setShowSuggestions(true);
            } catch {
                setSuggestions([]);
            }
        }, 250);
    }, [address]);

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

    // Fetch trends + activity when zip or reit filter changes
    useEffect(() => {
        if (!selectedZip) { setTrendData(null); setActivityData(null); return; }
        setLoading(true);
        Promise.all([
            supabase
                .rpc("get_rent_trends", { p_zip: selectedZip, p_reits_only: reitsOnly })
                .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as TrendRow[]; }),
            supabase
                .rpc("get_market_activity", { p_zip: selectedZip, p_reits_only: reitsOnly })
                .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as ActivityRow[]; }),
        ]).then(([trends, activity]) => {
            setLoading(false);
            if (trends !== null) setTrendData(trends);
            if (activity !== null) setActivityData(activity);
        });
    }, [selectedZip, reitsOnly]);

    const selectSuggestion = (feature: MapboxFeature) => {
        setAddress(feature.place_name);
        setSuggestions([]);
        setShowSuggestions(false);
        const postcodeCtx = feature.context?.find(c => c.id.startsWith("postcode."))?.text;
        const zip = feature.id.startsWith("postcode") ? feature.text : (postcodeCtx ?? null);
        if (zip) { setSelectedZip(zip); setSelectedLabel(feature.place_name); }
        else { setSelectedZip(null); setSelectedLabel(null); }
    };

    const chartData = trendData ? buildChartData(trendData) : [];

    return (
        <div className="flex-1 p-6 overflow-auto max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="size-5 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Rent Trends</h1>
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="flex items-center gap-4 mb-2">
                    <div className="flex-1 relative" ref={inputWrapperRef}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10 pointer-events-none" />
                        <Input
                            placeholder="Search address or zip code…"
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
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
                        <button
                            type="button"
                            onClick={() => setReitsOnly(false)}
                            className={`px-3 py-1.5 whitespace-nowrap transition-colors ${!reitsOnly ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            Non-REITs
                        </button>
                        <button
                            type="button"
                            onClick={() => setReitsOnly(true)}
                            className={`px-3 py-1.5 whitespace-nowrap transition-colors border-l border-gray-200 dark:border-gray-600 ${reitsOnly ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                            REITs
                        </button>
                    </div>
                </div>
                {selectedZip && selectedLabel && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Showing trends for: <span className="font-medium text-gray-700 dark:text-gray-300">ZIP {selectedZip}</span>
                        {" · "}{selectedLabel}
                    </p>
                )}
            </div>

            {/* Empty state */}
            {!selectedZip && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="size-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">Search an address or zip code to see rent trends</p>
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
                    <p className="text-gray-500 dark:text-gray-400">No rental data available for this zip code yet</p>
                </div>
            )}

            {/* Data */}
            {selectedZip && !loading && chartData.length > 0 && (
                <>
                    <RentTrendsSection chartData={chartData} />
                    {activityData && activityData.length > 0 && (
                        <MarketActivitySection activityData={activityData} />
                    )}
                </>
            )}
        </div>
    );
}
