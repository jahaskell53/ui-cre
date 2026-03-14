"use client";

import { useState, useEffect, useRef } from "react";
import { TrendingUp, ArrowUpRight, ArrowDownRight, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/utils/supabase";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

interface MapboxFeature {
    id: string;
    text: string;
    place_name: string;
    center: [number, number];
    context?: Array<{ id: string; text: string }>;
}

interface TrendRow {
    week_start: string;
    beds: number;
    median_rent: number;
    listing_count: number;
}

interface ChartPoint {
    week: string;
    weekLabel: string;
    studio?: number;
    "1bd"?: number;
    "2bd"?: number;
    "3bd+"?: number;
}

const BED_KEYS = [
    { beds: 0, key: "studio" as const, label: "Studio", color: "#6b7280" },
    { beds: 1, key: "1bd" as const, label: "1 bed", color: "#3b82f6" },
    { beds: 2, key: "2bd" as const, label: "2 bed", color: "#8b5cf6" },
    { beds: 3, key: "3bd+" as const, label: "3+ bed", color: "#f97316" },
];

function formatWeekLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatDollars(n: number): string {
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function buildChartData(rows: TrendRow[]): ChartPoint[] {
    const byWeek: Record<string, ChartPoint> = {};
    for (const row of rows) {
        const w = row.week_start;
        if (!byWeek[w]) {
            byWeek[w] = { week: w, weekLabel: formatWeekLabel(w) };
        }
        const bedEntry = BED_KEYS.find(b => b.beds === row.beds);
        if (bedEntry) {
            byWeek[w][bedEntry.key] = Math.round(row.median_rent);
        }
    }
    return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week));
}

function pctChange(first: number | undefined, last: number | undefined): number | null {
    if (first == null || last == null || first === 0) return null;
    return ((last - first) / first) * 100;
}

export default function TrendsPage() {
    const [address, setAddress] = useState("");
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedZip, setSelectedZip] = useState<string | null>(null);
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [trendData, setTrendData] = useState<TrendRow[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [includeReits, setIncludeReits] = useState(true);

    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);

    // Autocomplete
    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        if (address.length < 3) {
            setSuggestions([]);
            return;
        }
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

    // Fetch trends when zip or reit filter changes
    useEffect(() => {
        if (!selectedZip) {
            setTrendData(null);
            return;
        }
        setLoading(true);
        supabase
            .rpc("get_rent_trends", { p_zip: selectedZip, p_include_reits: includeReits })
            .then(({ data, error }) => {
                setLoading(false);
                if (error) { console.error(error); return; }
                setTrendData((data ?? []) as TrendRow[]);
            });
    }, [selectedZip, includeReits]);

    const selectSuggestion = (feature: MapboxFeature) => {
        setAddress(feature.place_name);
        setSuggestions([]);
        setShowSuggestions(false);
        // For postcode features, zip is in feature.text; for address features it's in context
        const postcodeCtx = feature.context?.find(c => c.id.startsWith("postcode."))?.text;
        const zip = feature.id.startsWith("postcode") ? feature.text : (postcodeCtx ?? null);
        if (zip) {
            setSelectedZip(zip);
            setSelectedLabel(feature.place_name);
        } else {
            setSelectedZip(null);
            setSelectedLabel(null);
        }
    };

    const chartData = trendData ? buildChartData(trendData) : [];
    const onlyOneWeek = chartData.length === 1;

    // Summary card values
    const summaryCards = BED_KEYS.map(({ beds, key, label, color }) => {
        const weeks = chartData.filter(p => p[key] != null);
        const latest = weeks.length > 0 ? weeks[weeks.length - 1][key] : undefined;
        const first = weeks.length > 0 ? weeks[0][key] : undefined;
        const change = weeks.length >= 2 ? pctChange(first, latest) : null;
        return { beds, key, label, color, latest, change };
    });

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
                        onChange={(e) => {
                            setAddress(e.target.value);
                            setSelectedZip(null);
                        }}
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
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={includeReits}
                            onChange={(e) => setIncludeReits(e.target.checked)}
                            className="size-4 rounded accent-blue-600"
                        />
                        Include REITs
                    </label>
                </div>
                {selectedZip && selectedLabel && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Showing trends for: <span className="font-medium text-gray-700 dark:text-gray-300">ZIP {selectedZip}</span>
                        {" · "}{selectedLabel}
                    </p>
                )}
            </div>

            {/* States */}
            {!selectedZip && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="size-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">Search an address or zip code to see rent trends</p>
                </div>
            )}

            {selectedZip && loading && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex items-center justify-center">
                    <p className="text-gray-400 text-sm">Loading…</p>
                </div>
            )}

            {selectedZip && !loading && trendData && trendData.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="size-10 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No rental data available for this zip code yet</p>
                </div>
            )}

            {selectedZip && !loading && chartData.length > 0 && (
                <>
                    {/* Chart */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Median Rent by Bedroom Type</h2>
                            {onlyOneWeek && (
                                <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
                                    More data coming as scrapes accumulate
                                </span>
                            )}
                        </div>
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="weekLabel"
                                    tick={{ fontSize: 12, fill: "#6b7280" }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tickFormatter={(v) => formatDollars(v)}
                                    tick={{ fontSize: 12, fill: "#6b7280" }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={75}
                                />
                                <Tooltip
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    formatter={(value: any, name: any) => [formatDollars(value as number), name as string]}
                                    labelFormatter={(label) => `Week of ${label}`}
                                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                                />
                                <Legend
                                    formatter={(value) => (
                                        <span style={{ fontSize: 12, color: "#374151" }}>{value}</span>
                                    )}
                                />
                                {BED_KEYS.map(({ key, label, color }) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        name={label}
                                        stroke={color}
                                        strokeWidth={2}
                                        dot={onlyOneWeek ? { r: 5, fill: color } : { r: 3 }}
                                        activeDot={{ r: 5 }}
                                        connectNulls={false}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {summaryCards.map(({ key, label, color, latest, change }) => (
                            <div
                                key={key}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                            >
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                                </div>
                                {latest != null ? (
                                    <>
                                        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                            {formatDollars(latest)}
                                        </p>
                                        {change != null ? (
                                            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                {change >= 0
                                                    ? <ArrowUpRight className="size-3.5" />
                                                    : <ArrowDownRight className="size-3.5" />}
                                                {Math.abs(change).toFixed(1)}% week-over-week
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 mt-1">— not enough data</p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-2xl font-semibold text-gray-400">—</p>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
