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

interface NeighborhoodResult {
    id: number;
    name: string;
    city: string;
    state: string;
}

const BED_OPTIONS = [
    { beds: 0, label: "Studio" },
    { beds: 1, label: "1BR" },
    { beds: 2, label: "2BR" },
    { beds: 3, label: "3BR" },
];

const AREA_TYPES = ["Address", "ZIP Code", "Neighborhood", "City", "County", "MSA"];
const ENABLED_AREA_TYPES = new Set(["Address", "ZIP Code", "Neighborhood"]);
const MAX_AREAS = 5;

interface AreaResult {
    trends: TrendRow[];
    activity: ActivityRow[];
}

export default function TrendsPage() {
    const [address, setAddress] = useState("");
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [nhSuggestions, setNhSuggestions] = useState<NeighborhoodResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [areaType, setAreaType] = useState<string>("Address");

    const [display, setDisplay] = useState<"chart" | "map">("chart");
    const [selectedAreas, setSelectedAreas] = useState<AreaSelection[]>([]);
    const [areaResults, setAreaResults] = useState<Record<string, AreaResult>>({});
    const [showAddInput, setShowAddInput] = useState(false);

    const [selectedBeds, setSelectedBeds] = useState<number>(1);
    const [reitsOnly, setReitsOnly] = useState(false);
    const [loading, setLoading] = useState(false);

    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const suggestListRef = useRef<HTMLUListElement>(null);
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
        setActiveSuggestionIndex(-1);
        if (address.length < 3) { setSuggestions([]); setNhSuggestions([]); return; }
        suggestTimerRef.current = setTimeout(async () => {
            if (areaType === "Neighborhood") {
                try {
                    const { data } = await supabase
                        .rpc('search_neighborhoods', { p_query: address });
                    setNhSuggestions((data ?? []) as NeighborhoodResult[]);
                    setShowSuggestions(true);
                } catch {
                    setNhSuggestions([]);
                }
            } else {
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
            }
        }, 250);
    }, [address, areaType]);

    // Scroll active suggestion into view
    useEffect(() => {
        if (activeSuggestionIndex < 0 || !suggestListRef.current) return;
        const item = suggestListRef.current.children[activeSuggestionIndex] as HTMLElement | undefined;
        item?.scrollIntoView({ block: 'nearest' });
    }, [activeSuggestionIndex]);

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
            selectedAreas.map(area => {
                const isNh = area.neighborhoodId != null;
                return Promise.all([
                    isNh
                        ? supabase
                            .rpc("get_rent_trends_by_neighborhood", { p_neighborhood_ids: [area.neighborhoodId!], p_beds: selectedBeds, p_reits_only: reitsOnly })
                            .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as TrendRow[]; })
                        : supabase
                            .rpc("get_rent_trends", { p_zip: area.id, p_beds: selectedBeds, p_reits_only: reitsOnly })
                            .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as TrendRow[]; }),
                    isNh
                        ? supabase
                            .rpc("get_market_activity_by_neighborhood", { p_neighborhood_ids: [area.neighborhoodId!], p_reits_only: reitsOnly })
                            .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as ActivityRow[]; })
                        : supabase
                            .rpc("get_market_activity", { p_zip: area.id, p_reits_only: reitsOnly })
                            .then(({ data, error }) => { if (error) { console.error(error); return null; } return (data ?? []) as ActivityRow[]; }),
                ]).then(([trends, activity]) => ({ id: area.id, trends, activity }));
            })
        ).then(results => {
            setLoading(false);
            const next: Record<string, AreaResult> = {};
            for (const r of results) {
                if (r.trends !== null && r.activity !== null) {
                    next[r.id] = { trends: r.trends!, activity: r.activity! };
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
        if (selectedAreas.find(a => a.id === zip)) return;
        if (selectedAreas.length >= MAX_AREAS) return;
        const placeCtx = feature.context?.find(c => c.id.startsWith("place."))?.text;
        const label = placeCtx ? `${zip} · ${placeCtx}` : zip;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas(prev => [...prev, { id: zip, label, color }]);
        setShowAddInput(false);
    };

    const selectNeighborhood = (nh: NeighborhoodResult) => {
        setAddress("");
        setNhSuggestions([]);
        setShowSuggestions(false);
        const key = `nh:${nh.id}`;
        if (selectedAreas.find(a => a.id === key)) return;
        if (selectedAreas.length >= MAX_AREAS) return;
        const label = `${nh.name} · ${nh.city}`;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas(prev => [...prev, { id: key, label, color, neighborhoodId: nh.id }]);
        setShowAddInput(false);
    };

    const addAreaByZip = (zip: string) => {
        if (selectedAreas.find(a => a.id === zip)) { removeArea(zip); return; }
        if (selectedAreas.length >= MAX_AREAS) return;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas(prev => [...prev, { id: zip, label: zip, color }]);
    };

    const removeArea = (id: string) => {
        setSelectedAreas(prev => prev.filter(a => a.id !== id));
        setAreaResults(prev => { const next = { ...prev }; delete next[id]; return next; });
    };

    const rentResults: Record<string, TrendRow[]> = {};
    const activityResults: Record<string, ActivityRow[]> = {};
    for (const area of selectedAreas) {
        if (areaResults[area.id]) {
            rentResults[area.id] = areaResults[area.id].trends;
            activityResults[area.id] = areaResults[area.id].activity;
        }
    }

    const hasData = selectedAreas.some(a => (rentResults[a.id]?.length ?? 0) > 0);
    const hasActivity = selectedAreas.some(a => (activityResults[a.id]?.length ?? 0) > 0);

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

    const searchPlaceholder =
        areaType === "ZIP Code" ? "Enter zip code…" :
        areaType === "Neighborhood" ? "Search neighborhood name…" :
        "Enter address…";

    return (
        <div className="flex-1 p-6 overflow-auto max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-blue-600" />
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Rent Trends</h1>
                </div>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
                    <button type="button" onClick={() => setDisplay("chart")} className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${display === "chart" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                        <BarChart2 className="size-3.5" /> Chart
                    </button>
                    <button type="button" onClick={() => { setDisplay("map"); setAreaType("ZIP Code"); setAddress(""); setSuggestions([]); setNhSuggestions([]); }} className={`flex items-center gap-1.5 px-3 py-1.5 border-l border-gray-200 dark:border-gray-600 transition-colors ${display === "map" ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
                        <Map className="size-3.5" /> Map
                    </button>
                </div>
            </div>

            {/* Filter panel */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6 space-y-4">
                {/* Area type — hidden in Map display mode */}
                {display === "chart" && <div className="flex items-center gap-4">
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
                                    onClick={() => { if (enabled) { setAreaType(t); setAddress(""); setSuggestions([]); setNhSuggestions([]); } }}
                                    className={`px-3 py-1.5 whitespace-nowrap transition-colors ${i > 0 ? 'border-l border-gray-200 dark:border-gray-600' : ''} ${active ? 'bg-blue-600 text-white' : enabled ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700' : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}`}
                                >
                                    {t}
                                </button>
                            );
                        })}
                    </div>
                </div>}

                {/* Area search */}
                <div className="flex items-start gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24 shrink-0 pt-2">Area</span>
                    <div className="flex-1 space-y-2">
                        {/* Chips + add button */}
                        {selectedAreas.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedAreas.map(area => (
                                    <span
                                        key={area.id}
                                        className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border font-medium"
                                        style={{ borderColor: area.color, color: area.color, backgroundColor: `${area.color}14` }}
                                    >
                                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                                        {area.label}
                                        <button
                                            type="button"
                                            onClick={() => removeArea(area.id)}
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
                                    placeholder={searchPlaceholder}
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    onKeyDown={(e) => {
                                        const list = areaType === "Neighborhood" ? nhSuggestions : suggestions;
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setActiveSuggestionIndex(i => Math.min(i + 1, list.length - 1));
                                        } else if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setActiveSuggestionIndex(i => Math.max(i - 1, 0));
                                        } else if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (activeSuggestionIndex >= 0) {
                                                if (areaType === "Neighborhood") selectNeighborhood(nhSuggestions[activeSuggestionIndex]);
                                                else selectSuggestion(suggestions[activeSuggestionIndex]);
                                                setActiveSuggestionIndex(-1);
                                            }
                                        } else if (e.key === "Escape") {
                                            setShowSuggestions(false);
                                            setActiveSuggestionIndex(-1);
                                            if (selectedAreas.length > 0) { setShowAddInput(false); setAddress(""); }
                                        }
                                    }}
                                    onFocus={() => (suggestions.length > 0 || nhSuggestions.length > 0) && setShowSuggestions(true)}
                                    className="pl-9"
                                    autoComplete="off"
                                    autoFocus={showAddInput}
                                />
                                {showSuggestions && areaType === "Neighborhood" && nhSuggestions.length > 0 && (
                                    <ul ref={suggestListRef} className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-y-auto max-h-60">
                                        {nhSuggestions.map((nh, i) => (
                                            <li key={nh.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); selectNeighborhood(nh); }}
                                                    className={`w-full text-left px-3 py-2.5 text-sm flex items-start gap-2 transition-colors ${i === activeSuggestionIndex ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                                >
                                                    <MapPin className="size-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                                    <span className="text-gray-800 dark:text-gray-200 leading-snug">{nh.name} · {nh.city}, {nh.state}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {showSuggestions && areaType !== "Neighborhood" && suggestions.length > 0 && (
                                    <ul ref={suggestListRef} className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-y-auto max-h-60">
                                        {suggestions.map((feature, i) => (
                                            <li key={feature.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(feature); }}
                                                    className={`w-full text-left px-3 py-2.5 text-sm flex items-start gap-2 transition-colors ${i === activeSuggestionIndex ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
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

            {/* Map display */}
            {display === "map" && (
                <ZipTrendsMap
                    selectedBeds={selectedBeds}
                    reitsOnly={reitsOnly}
                    selectedAreas={selectedAreas}
                    onAddArea={addAreaByZip}
                />
            )}

            {/* Empty state — chart display with no areas selected */}
            {display === "chart" && selectedAreas.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="size-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">Search an address, zip code, or neighborhood above to see rent trends</p>
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
                            const rows = (rentResults[area.id] ?? [])
                                .filter(r => r.beds === selectedBeds)
                                .sort((a, b) => a.week_start.localeCompare(b.week_start));
                            const latest = rows.length > 0 ? rows[rows.length - 1].median_rent : undefined;
                            const first = rows.length > 0 ? rows[0].median_rent : undefined;
                            const change = rows.length >= 2 ? pctChange(first, latest) : null;
                            return (
                                <div key={area.id}>
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
