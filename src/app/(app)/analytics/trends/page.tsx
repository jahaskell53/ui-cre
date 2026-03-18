"use client";

import { useState, useEffect, useRef } from "react";
import { TrendingUp, MapPin, Search, ArrowUpRight, ArrowDownRight, X, BarChart2, Map } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/utils/supabase";
import {
    TrendRow,
    ActivityRow,
    BED_KEYS,
    AREA_COLORS,
    AreaSelection,
    pctChange,
    formatDollars,
} from "./trends-utils";
import { RentTrendsSection } from "./rent-trends-section";
import { MarketActivitySection } from "./market-activity-section";
import { ZipTrendsMap } from "./zip-trends-map";

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
const MAX_AREAS = 5;

interface AreaResult {
    trends: TrendRow[];
    activity: ActivityRow[];
}

export default function TrendsPage() {
    const [address, setAddress] = useState("");
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [areaType, setAreaType] = useState<string>("Address");

    const [view, setView] = useState<"chart" | "map">("chart");
    const [selectedAreas, setSelectedAreas] = useState<AreaSelection[]>([]);
    const [areaResults, setAreaResults] = useState<Record<string, AreaResult>>({});
    const [showAddInput, setShowAddInput] = useState(false);

    const [selectedBeds, setSelectedBeds] = useState<number>(1);
    const [reitsOnly, setReitsOnly] = useState(false);
    const [loading, setLoading] = useState(false);

    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const userCoordsRef = useRef<{ lng: number; lat: number } | null>(null);

    // Get user location once for proximity bias
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => { userCoordsRef.current = { lng: pos.coords.longitude, lat: pos.coords.latitude }; },
            () => { /* permission denied — no proximity bias */ }
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

    // Fetch when areas or filters change
    useEffect(() => {
        if (selectedAreas.length === 0) { setAreaResults({}); return; }
        setLoading(true);
        Promise.all(
            selectedAreas.map(area =>
                Promise.all([
                    supabase
                        .rpc("get_rent_trends", { p_zip: area.zip, p_beds: selectedBeds, p_reits_only: reitsOnly })
                        .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as TrendRow[]; }),
                    supabase
                        .rpc("get_market_activity", { p_zip: area.zip, p_reits_only: reitsOnly })
                        .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as ActivityRow[]; }),
                ]).then(([trends, activity]) => ({ zip: area.zip, trends, activity }))
            )
        ).then(results => {
            setLoading(false);
            const next: Record<string, AreaResult> = {};
            for (const r of results) {
                if (r.trends !== null && r.activity !== null) {
                    next[r.zip] = { trends: r.trends!, activity: r.activity! };
                }
            }
            setAreaResults(next);
        });
    }, [selectedAreas, selectedBeds, reitsOnly]);

    const selectSuggestion = (feature: MapboxFeature) => {
        setAddress("");
        setSuggestions([]);
        setShowSuggestions(false);
        const postcodeCtx = feature.context?.find(c => c.id.startsWith("postcode."))?.text;
        const zip = feature.id.startsWith("postcode") ? feature.text : (postcodeCtx ?? null);
        if (!zip) return;
        if (selectedAreas.find(a => a.zip === zip)) return;
        if (selectedAreas.length >= MAX_AREAS) return;
        const placeCtx = feature.context?.find(c => c.id.startsWith("place."))?.text;
        const label = placeCtx ? `${zip} · ${placeCtx}` : zip;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas(prev => [...prev, { zip, label, color }]);
        setShowAddInput(false);
    };

    const addAreaByZip = (zip: string) => {
        if (selectedAreas.find(a => a.zip === zip)) { removeArea(zip); return; }
        if (selectedAreas.length >= MAX_AREAS) return;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas(prev => [...prev, { zip, label: zip, color }]);
    };

    const removeArea = (zip: string) => {
        setSelectedAreas(prev => prev.filter(a => a.zip !== zip));
        setAreaResults(prev => { const next = { ...prev }; delete next[zip]; return next; });
    };

    const rentResults: Record<string, TrendRow[]> = {};
    const activityResults: Record<string, ActivityRow[]> = {};
    for (const area of selectedAreas) {
        if (areaResults[area.zip]) {
            rentResults[area.zip] = areaResults[area.zip].trends;
            activityResults[area.zip] = areaResults[area.zip].activity;
        }
    }

    const hasData = selectedAreas.some(a => (rentResults[a.zip]?.length ?? 0) > 0);
    const hasActivity = selectedAreas.some(a => (activityResults[a.zip]?.length ?? 0) > 0);

    const segmentToggle = (label: string, active: boolean, onClick: () => void, first = false) => (
        <button
            key={label}
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
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-blue-600" />
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Rent Trends</h1>
                </div>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
                    <button
                        type="button"
                        onClick={() => setView("chart")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${view === "chart" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                        <BarChart2 className="size-3.5" /> Chart
                    </button>
                    <button
                        type="button"
                        onClick={() => setView("map")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border-l border-gray-200 dark:border-gray-600 transition-colors ${view === "map" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                        <Map className="size-3.5" /> Map
                    </button>
                </div>
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
                                    onClick={() => { if (enabled) { setAreaType(t); setAddress(""); setSuggestions([]); } }}
                                    className={`px-3 py-1.5 whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200 dark:border-gray-600' : ''} ${active ? 'bg-blue-600 text-white' : enabled ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
                                >
                                    {t}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Area search */}
                <div className="flex items-start gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24 shrink-0 pt-2">Area</span>
                    <div className="flex-1 space-y-2">
                        {/* Chips + add button */}
                        {selectedAreas.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedAreas.map(area => (
                                    <span
                                        key={area.zip}
                                        className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border font-medium"
                                        style={{ borderColor: area.color, color: area.color, backgroundColor: `${area.color}14` }}
                                    >
                                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                                        {area.label}
                                        <button
                                            type="button"
                                            onClick={() => removeArea(area.zip)}
                                            className="ml-0.5 hover:opacity-60 transition-opacity"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </span>
                                ))}
                                {selectedAreas.length < MAX_AREAS && (
                                    <button
                                        type="button"
                                        onClick={() => { setShowAddInput(true); setAddress(""); }}
                                        className="size-6 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                                        title="Add area to compare"
                                    >
                                        <span className="text-base leading-none mb-px">+</span>
                                    </button>
                                )}
                            </div>
                        )}
                        {/* Search input — always shown for first area, toggled for subsequent */}
                        {(selectedAreas.length === 0 || showAddInput) && (
                            <div className="relative" ref={inputWrapperRef}>
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10 pointer-events-none" />
                                <Input
                                    placeholder={areaType === "ZIP Code" ? "Enter zip code…" : "Enter address…"}
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") {
                                            setShowSuggestions(false);
                                            if (selectedAreas.length > 0) { setShowAddInput(false); setAddress(""); }
                                        }
                                    }}
                                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                    className="pl-9"
                                    autoComplete="off"
                                    autoFocus={showAddInput}
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

            {/* Map view */}
            {view === "map" && (
                <ZipTrendsMap
                    selectedBeds={selectedBeds}
                    reitsOnly={reitsOnly}
                    selectedAreas={selectedAreas}
                    onAddArea={addAreaByZip}
                />
            )}

            {/* Empty state — chart view with no areas selected */}
            {view === "chart" && selectedAreas.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="size-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">Search an address or zip code above to see rent trends</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add up to {MAX_AREAS} areas to compare</p>
                </div>
            )}

            {/* Charts — shown in both views when areas are selected */}
            {selectedAreas.length > 0 && <>

            {/* Loading */}
            {selectedAreas.length > 0 && loading && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex items-center justify-center">
                    <p className="text-gray-400 text-sm">Loading…</p>
                </div>
            )}

            {/* No data */}
            {selectedAreas.length > 0 && !loading && !hasData && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="size-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No data for the selected areas and bedroom type</p>
                </div>
            )}

            {/* Grid dashboard */}
            {selectedAreas.length > 0 && !loading && hasData && (
                <div className="grid grid-cols-4 gap-4">
                    {/* Stat tile */}
                    <div className="col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-5">
                        {selectedAreas.map(area => {
                            const rows = (rentResults[area.zip] ?? [])
                                .filter(r => r.beds === selectedBeds)
                                .sort((a, b) => a.week_start.localeCompare(b.week_start));
                            const latest = rows.length > 0 ? rows[rows.length - 1].median_rent : undefined;
                            const first = rows.length > 0 ? rows[0].median_rent : undefined;
                            const change = rows.length >= 2 ? pctChange(first, latest) : null;
                            return (
                                <div key={area.zip}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{area.label}</span>
                                    </div>
                                    {latest != null ? (
                                        <>
                                            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{formatDollars(latest)}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{BED_KEYS.find(b => b.beds === selectedBeds)!.label} · latest week</p>
                                            {change != null && (
                                                <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                    {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                                                    {Math.abs(change).toFixed(1)}% over period
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xl font-semibold text-gray-400">—</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Rent chart */}
                    <div className="col-span-3">
                        <RentTrendsSection areas={selectedAreas} areaResults={rentResults} selectedBeds={selectedBeds} />
                    </div>

                    {/* Activity chart */}
                    {hasActivity && (
                        <div className="col-span-4 mb-8">
                            <MarketActivitySection areas={selectedAreas} areaResults={activityResults} selectedBeds={selectedBeds} />
                        </div>
                    )}
                </div>
            )}

            </> /* end chart view */}
        </div>
    );
}
