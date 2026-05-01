"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, TrendingUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, CartesianGrid, ComposedChart, ErrorBar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    type SalesTrendRowV2,
    getCrexiSalesTrendsByCityV2,
    getCrexiSalesTrendsByCountyV2,
    getCrexiSalesTrendsByMsaV2,
    getCrexiSalesTrendsByNeighborhoodV2,
    getCrexiSalesTrendsV2,
    searchMsas,
    searchNeighborhoods,
} from "@/db/rpc";
import { MAX_TREND_AREAS, getTrendsSearchPlaceholder, parseSerializedAreas, serializeAreasParam } from "@/lib/analytics/trends-page";
import { AREA_COLORS, type AreaSelection } from "../trends/trends-utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

type AreaType = "Neighborhood" | "ZIP Code" | "City" | "County" | "MSA";
type Period = "3M" | "6M" | "9M" | "1Y" | "2Y" | "5Y" | "10Y" | "Max";
type SampleComps = "1M" | "3M" | "6M" | "1Y";
type DisplayType = "Average" | "Candle" | "Median";
type Metric = "cap_rate" | "cost_per_unit" | "grm";
type UnitFilter = "All" | "2-4" | "5-10" | "11-25" | "26-50" | "51+" | "custom";
type RentBasis = "Current" | "Stabilized" | "Market";

const AREA_TYPES: AreaType[] = ["Neighborhood", "ZIP Code", "City", "County", "MSA"];
const PERIOD_OPTIONS: Period[] = ["3M", "6M", "9M", "1Y", "2Y", "5Y", "10Y", "Max"];
const SAMPLE_COMPS_OPTIONS: SampleComps[] = ["1M", "3M", "6M", "1Y"];
const DISPLAY_OPTIONS: { value: DisplayType; label: string }[] = [
    { value: "Average", label: "Average" },
    { value: "Candle", label: "Candle" },
    { value: "Median", label: "Median" },
];
const METRIC_OPTIONS: { value: Metric; label: string; disabled?: boolean }[] = [
    { value: "cap_rate", label: "Cap Rate" },
    { value: "cost_per_unit", label: "Cost/Unit" },
    { value: "grm", label: "GRM", disabled: true },
];
const UNIT_PRESETS: { value: UnitFilter; label: string }[] = [
    { value: "All", label: "All" },
    { value: "2-4", label: "2–4" },
    { value: "5-10", label: "5–10" },
    { value: "11-25", label: "11–25" },
    { value: "26-50", label: "26–50" },
    { value: "51+", label: "51+" },
    { value: "custom", label: "Custom" },
];

const RENT_BASIS_OPTIONS: RentBasis[] = ["Current", "Stabilized", "Market"];

interface MapboxFeature {
    id: string;
    text: string;
    place_name: string;
    center: [number, number];
    context?: Array<{ id: string; text: string; short_code?: string }>;
}

interface NeighborhoodResult {
    id: number;
    name: string;
    city: string;
    state: string;
}

function filterByPeriod(rows: SalesTrendRowV2[], period: Period): SalesTrendRowV2[] {
    if (period === "Max") return rows;
    const months: Record<Period, number> = {
        "3M": 3,
        "6M": 6,
        "9M": 9,
        "1Y": 12,
        "2Y": 24,
        "5Y": 60,
        "10Y": 120,
        Max: 0,
    };
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months[period]);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return rows.filter((r) => r.month_start >= cutoffStr);
}

function aggregateBySampleWindow(rows: SalesTrendRowV2[], sampleComps: SampleComps): SalesTrendRowV2[] {
    if (rows.length === 0) return [];
    const monthsPerWindow: Record<SampleComps, number> = {
        "1M": 1,
        "3M": 3,
        "6M": 6,
        "1Y": 12,
    };
    const windowSize = monthsPerWindow[sampleComps];
    if (windowSize === 1) return rows;

    const sorted = [...rows].sort((a, b) => a.month_start.localeCompare(b.month_start));
    const buckets: Record<string, SalesTrendRowV2[]> = {};
    for (const row of sorted) {
        const d = new Date(row.month_start + "T00:00:00Z");
        const monthIndex = d.getUTCFullYear() * 12 + d.getUTCMonth();
        const bucketIndex = Math.floor(monthIndex / windowSize) * windowSize;
        const bucketYear = Math.floor(bucketIndex / 12);
        const bucketMonth = bucketIndex % 12;
        const key = `${bucketYear}-${String(bucketMonth + 1).padStart(2, "0")}-01`;
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(row);
    }

    return Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, group]) => {
            const medians = group.map((r) => r.median_price).filter((p) => p != null);
            const avgs = group.map((r) => r.avg_price).filter((p) => p != null);
            const p25s = group.map((r) => r.p25_price).filter((p) => p != null);
            const p75s = group.map((r) => r.p75_price).filter((p) => p != null);
            const caps = group.map((r) => r.avg_cap_rate).filter((c) => c != null) as number[];
            const median = (arr: number[]) => {
                const s = [...arr].sort((a, b) => a - b);
                const m = Math.floor(s.length / 2);
                return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
            };
            const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
            return {
                month_start: key,
                median_price: medians.length > 0 ? median(medians) : 0,
                avg_price: avgs.length > 0 ? avg(avgs) : 0,
                p25_price: p25s.length > 0 ? median(p25s) : 0,
                p75_price: p75s.length > 0 ? median(p75s) : 0,
                avg_cap_rate: caps.length > 0 ? avg(caps) : null,
                listing_count: group.reduce((s, r) => s + r.listing_count, 0),
            };
        });
}

function metricValue(row: SalesTrendRowV2, metric: Metric, displayType: DisplayType): number | null {
    if (metric === "cap_rate") return row.avg_cap_rate;
    if (metric === "cost_per_unit") {
        if (displayType === "Average") return row.avg_price;
        return row.median_price;
    }
    return null;
}

function formatMetricValue(value: number, metric: Metric): string {
    if (metric === "cap_rate") return `${value.toFixed(2)}%`;
    if (metric === "cost_per_unit") {
        if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
        return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }
    return value.toFixed(1) + "x";
}

function formatYAxisValue(value: number, metric: Metric): string {
    if (metric === "cap_rate") return `${value.toFixed(1)}%`;
    if (metric === "cost_per_unit") {
        if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
    }
    return value.toFixed(1) + "x";
}

function formatMonthLabel(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
    });
}

const LISTINGS_PAGE_SIZE = 25;

type CrexiBucketListingRow = {
    id: number;
    crexi_id: string | null;
    property_name: string | null;
    address_full: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    property_price_total: number | null;
    num_units: number | null;
    price_per_door: number | null;
    sale_transaction_date: string | null;
    sale_cap_rate_percent: number | null;
    financials_cap_rate_percent: number | null;
};

function monthsPerSampleWindow(sampleComps: SampleComps): number {
    const m: Record<SampleComps, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };
    return m[sampleComps];
}

function areaKindAndQuery(area: AreaSelection, areaType: AreaType): { areaKind: string; query: Record<string, string> } | null {
    if (areaType === "Neighborhood" && area.neighborhoodId != null) {
        return { areaKind: "neighborhood", query: { neighborhoodIds: String(area.neighborhoodId) } };
    }
    if (areaType === "MSA" && area.msaGeoid) {
        return { areaKind: "msa", query: { geoid: area.msaGeoid } };
    }
    if (areaType === "County" && area.countyName && area.countyState) {
        return { areaKind: "county", query: { countyName: area.countyName, state: area.countyState } };
    }
    if (areaType === "City" && area.cityName && area.cityState) {
        return { areaKind: "city", query: { city: area.cityName, state: area.cityState } };
    }
    if (areaType === "ZIP Code") {
        return { areaKind: "zip", query: { zip: area.id } };
    }
    return null;
}

function formatUsd0(n: number): string {
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function verticalScaleLabel(metric: Metric): string {
    if (metric === "cost_per_unit") return "$ (Cost/Unit)";
    if (metric === "grm") return "GRM (no unit)";
    return "% (Cap Rate)";
}

export default function SalesTrendsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [areaType, setAreaType] = useState<AreaType>((searchParams.get("areaType") as AreaType) ?? "ZIP Code");
    const [period, setPeriod] = useState<Period>((searchParams.get("period") as Period) ?? "5Y");
    const [sampleComps, setSampleComps] = useState<SampleComps>((searchParams.get("sampleComps") as SampleComps) ?? "3M");
    const [displayType, setDisplayType] = useState<DisplayType>((searchParams.get("display") as DisplayType) ?? "Median");
    const [metric, setMetric] = useState<Metric>((searchParams.get("metric") as Metric) ?? "cost_per_unit");
    const [unitFilter, setUnitFilter] = useState<UnitFilter>((searchParams.get("units") as UnitFilter) ?? "All");
    const [unitMin, setUnitMin] = useState(searchParams.get("unitMin") ?? "");
    const [unitMax, setUnitMax] = useState(searchParams.get("unitMax") ?? "");
    const [rentBasis, setRentBasis] = useState<RentBasis>((searchParams.get("rentBasis") as RentBasis) ?? "Current");

    const [selectedAreas, setSelectedAreas] = useState<AreaSelection[]>(() => parseSerializedAreas(searchParams.get("areas")));
    const [compareAreas, setCompareAreas] = useState<AreaSelection[]>([]);
    const [salesResults, setSalesResults] = useState<Record<string, SalesTrendRowV2[]>>({});
    const [loading, setLoading] = useState(false);

    const [bucketListingsOpen, setBucketListingsOpen] = useState(false);
    const [bucketModalAreaId, setBucketModalAreaId] = useState<string | null>(null);
    const [bucketModalMonth, setBucketModalMonth] = useState<string | null>(null);
    const [listingsPage, setListingsPage] = useState(0);
    const [listingsTotal, setListingsTotal] = useState(0);
    const [listingsRows, setListingsRows] = useState<CrexiBucketListingRow[]>([]);
    const [listingsLoading, setListingsLoading] = useState(false);
    const [listingsError, setListingsError] = useState<string | null>(null);

    const [address, setAddress] = useState("");
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [nhSuggestions, setNhSuggestions] = useState<NeighborhoodResult[]>([]);
    const [msaSuggestions, setMsaSuggestions] = useState<{ id: number; name: string; name_lsad: string; geoid: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showAddInput, setShowAddInput] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const suggestListRef = useRef<HTMLUListElement>(null);
    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suggestAbortRef = useRef<AbortController | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const userCoordsRef = useRef<{ lng: number; lat: number } | null>(null);

    const [compareAddress, setCompareAddress] = useState("");
    const [compareSuggestions, setCompareSuggestions] = useState<MapboxFeature[]>([]);
    const [compareNhSuggestions, setCompareNhSuggestions] = useState<NeighborhoodResult[]>([]);
    const [compareMsaSuggestions, setCompareMsaSuggestions] = useState<{ id: number; name: string; name_lsad: string; geoid: string }[]>([]);
    const [showCompareSuggestions, setShowCompareSuggestions] = useState(false);
    const [showCompareInput, setShowCompareInput] = useState(false);
    const compareInputWrapperRef = useRef<HTMLDivElement>(null);
    const compareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const compareAbortRef = useRef<AbortController | null>(null);
    const [compareActiveSuggestionIndex, setCompareActiveSuggestionIndex] = useState(-1);
    const compareSuggestListRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoordsRef.current = {
                    lng: pos.coords.longitude,
                    lat: pos.coords.latitude,
                };
            },
            () => {},
        );
    }, []);

    // URL sync
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("areaType", areaType);
        params.set("period", period);
        params.set("sampleComps", sampleComps);
        params.set("display", displayType);
        params.set("metric", metric);
        params.set("units", unitFilter);
        params.set("rentBasis", rentBasis);
        if (unitFilter === "custom") {
            if (unitMin) params.set("unitMin", unitMin);
            if (unitMax) params.set("unitMax", unitMax);
        }
        if (selectedAreas.length > 0) params.set("areas", serializeAreasParam(selectedAreas));
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [areaType, period, sampleComps, displayType, metric, unitFilter, unitMin, unitMax, rentBasis, selectedAreas]); // eslint-disable-line react-hooks/exhaustive-deps

    // Autocomplete for primary area
    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        suggestAbortRef.current?.abort();
        setActiveSuggestionIndex(-1);
        if (address.length < 3) {
            setSuggestions([]);
            setNhSuggestions([]);
            setMsaSuggestions([]);
            return;
        }
        let cancelled = false;
        const controller = new AbortController();
        suggestAbortRef.current = controller;
        suggestTimerRef.current = setTimeout(async () => {
            if (areaType === "MSA") {
                try {
                    const proximity = userCoordsRef.current ?? undefined;
                    const data = await searchMsas({ p_query: address, p_lat: proximity?.lat, p_lng: proximity?.lng }, { signal: controller.signal });
                    if (!cancelled) {
                        setMsaSuggestions(data);
                        setShowSuggestions(true);
                    }
                } catch {
                    if (!cancelled) setMsaSuggestions([]);
                }
            } else if (areaType === "Neighborhood") {
                try {
                    const proximity = userCoordsRef.current ?? undefined;
                    const data = await searchNeighborhoods({ p_query: address, p_lat: proximity?.lat, p_lng: proximity?.lng }, { signal: controller.signal });
                    if (!cancelled) {
                        setNhSuggestions(data);
                        setShowSuggestions(true);
                    }
                } catch {
                    if (!cancelled) setNhSuggestions([]);
                }
            } else {
                try {
                    const types = areaType === "ZIP Code" ? "postcode" : areaType === "City" ? "place" : areaType === "County" ? "district" : "address";
                    const proximity = userCoordsRef.current ? `&proximity=${userCoordsRef.current.lng},${userCoordsRef.current.lat}` : "";
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&types=${types}&country=US${proximity}`,
                        { signal: controller.signal },
                    );
                    const data = await res.json();
                    if (!cancelled) {
                        setSuggestions((data.features ?? []) as MapboxFeature[]);
                        setShowSuggestions(true);
                    }
                } catch {
                    if (!cancelled) setSuggestions([]);
                }
            }
        }, 180);
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [address, areaType]);

    // Close primary suggestions on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Close compare suggestions on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (compareInputWrapperRef.current && !compareInputWrapperRef.current.contains(e.target as Node)) {
                setShowCompareSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Compare autocomplete
    useEffect(() => {
        if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
        compareAbortRef.current?.abort();
        setCompareActiveSuggestionIndex(-1);
        if (compareAddress.length < 3) {
            setCompareSuggestions([]);
            setCompareNhSuggestions([]);
            setCompareMsaSuggestions([]);
            return;
        }
        let cancelled = false;
        const controller = new AbortController();
        compareAbortRef.current = controller;
        compareTimerRef.current = setTimeout(async () => {
            if (areaType === "MSA") {
                try {
                    const proximity = userCoordsRef.current ?? undefined;
                    const data = await searchMsas(
                        {
                            p_query: compareAddress,
                            p_lat: proximity?.lat,
                            p_lng: proximity?.lng,
                        },
                        { signal: controller.signal },
                    );
                    if (!cancelled) {
                        setCompareMsaSuggestions(data);
                        setShowCompareSuggestions(true);
                    }
                } catch {
                    if (!cancelled) setCompareMsaSuggestions([]);
                }
            } else if (areaType === "Neighborhood") {
                try {
                    const proximity = userCoordsRef.current ?? undefined;
                    const data = await searchNeighborhoods(
                        {
                            p_query: compareAddress,
                            p_lat: proximity?.lat,
                            p_lng: proximity?.lng,
                        },
                        { signal: controller.signal },
                    );
                    if (!cancelled) {
                        setCompareNhSuggestions(data);
                        setShowCompareSuggestions(true);
                    }
                } catch {
                    if (!cancelled) setCompareNhSuggestions([]);
                }
            } else {
                try {
                    const types = areaType === "ZIP Code" ? "postcode" : areaType === "City" ? "place" : areaType === "County" ? "district" : "address";
                    const proximity = userCoordsRef.current ? `&proximity=${userCoordsRef.current.lng},${userCoordsRef.current.lat}` : "";
                    const res = await fetch(
                        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(compareAddress)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&types=${types}&country=US${proximity}`,
                        { signal: controller.signal },
                    );
                    const data = await res.json();
                    if (!cancelled) {
                        setCompareSuggestions((data.features ?? []) as MapboxFeature[]);
                        setShowCompareSuggestions(true);
                    }
                } catch {
                    if (!cancelled) setCompareSuggestions([]);
                }
            }
        }, 180);
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [compareAddress, areaType]);

    const selectSuggestion = useCallback(
        (feature: MapboxFeature) => {
            setAddress("");
            setSuggestions([]);
            setShowSuggestions(false);
            setActiveSuggestionIndex(-1);

            if (areaType === "County") {
                const countyName = feature.text;
                const regionCtx = feature.context?.find((c) => c.id.startsWith("region."));
                const stateCode = (regionCtx?.short_code ?? "").replace("US-", "");
                const key = `county:${countyName}:${stateCode}`;
                if (selectedAreas.find((a) => a.id === key)) return;
                if (selectedAreas.length >= MAX_TREND_AREAS) return;
                const label = stateCode ? `${countyName}, ${stateCode}` : countyName;
                const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
                setSelectedAreas((prev) => [...prev, { id: key, label, color, countyName, countyState: stateCode }]);
                setShowAddInput(false);
                return;
            }

            if (areaType === "City") {
                const cityName = feature.text;
                const regionCtx = feature.context?.find((c) => c.id.startsWith("region."));
                const stateCode = (regionCtx?.short_code ?? "").replace("US-", "");
                const key = `city:${cityName}:${stateCode}`;
                if (selectedAreas.find((a) => a.id === key)) return;
                if (selectedAreas.length >= MAX_TREND_AREAS) return;
                const label = stateCode ? `${cityName}, ${stateCode}` : cityName;
                const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
                setSelectedAreas((prev) => [...prev, { id: key, label, color, cityName, cityState: stateCode }]);
                setShowAddInput(false);
                return;
            }

            const postcodeCtx = feature.context?.find((c) => c.id.startsWith("postcode."))?.text;
            const zip = feature.id.startsWith("postcode") ? feature.text : (postcodeCtx ?? null);
            if (!zip) return;
            if (selectedAreas.find((a) => a.id === zip)) return;
            if (selectedAreas.length >= MAX_TREND_AREAS) return;
            const placeCtx = feature.context?.find((c) => c.id.startsWith("place."))?.text;
            const label = placeCtx ? `${zip} · ${placeCtx}` : zip;
            const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
            setSelectedAreas((prev) => [...prev, { id: zip, label, color }]);
            setShowAddInput(false);
        },
        [areaType, selectedAreas],
    );

    const selectNeighborhood = useCallback(
        (nh: NeighborhoodResult) => {
            setAddress("");
            setNhSuggestions([]);
            setShowSuggestions(false);
            const key = `nh:${nh.id}`;
            if (selectedAreas.find((a) => a.id === key)) return;
            if (selectedAreas.length >= MAX_TREND_AREAS) return;
            const label = `${nh.name} · ${nh.city}`;
            const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
            setSelectedAreas((prev) => [...prev, { id: key, label, color, neighborhoodId: nh.id }]);
            setShowAddInput(false);
        },
        [selectedAreas],
    );

    const selectMsa = useCallback(
        (msa: { id: number; name: string; name_lsad: string; geoid: string }) => {
            setAddress("");
            setMsaSuggestions([]);
            setShowSuggestions(false);
            setActiveSuggestionIndex(-1);
            const key = `msa:${msa.geoid}`;
            if (selectedAreas.find((a) => a.id === key)) return;
            if (selectedAreas.length >= MAX_TREND_AREAS) return;
            const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
            setSelectedAreas((prev) => [...prev, { id: key, label: msa.name, color, msaGeoid: msa.geoid }]);
            setShowAddInput(false);
        },
        [selectedAreas],
    );

    const selectCompareSuggestion = useCallback(
        (feature: MapboxFeature) => {
            setCompareAddress("");
            setCompareSuggestions([]);
            setShowCompareSuggestions(false);
            setCompareActiveSuggestionIndex(-1);
            const allAreas = [...selectedAreas, ...compareAreas];

            if (areaType === "County") {
                const countyName = feature.text;
                const regionCtx = feature.context?.find((c) => c.id.startsWith("region."));
                const stateCode = (regionCtx?.short_code ?? "").replace("US-", "");
                const key = `county:${countyName}:${stateCode}`;
                if (allAreas.find((a) => a.id === key)) return;
                const label = stateCode ? `${countyName}, ${stateCode}` : countyName;
                const color = AREA_COLORS[(selectedAreas.length + compareAreas.length) % AREA_COLORS.length];
                setCompareAreas((prev) => [...prev, { id: key, label, color, countyName, countyState: stateCode }]);
                setShowCompareInput(false);
                return;
            }

            if (areaType === "City") {
                const cityName = feature.text;
                const regionCtx = feature.context?.find((c) => c.id.startsWith("region."));
                const stateCode = (regionCtx?.short_code ?? "").replace("US-", "");
                const key = `city:${cityName}:${stateCode}`;
                if (allAreas.find((a) => a.id === key)) return;
                const label = stateCode ? `${cityName}, ${stateCode}` : cityName;
                const color = AREA_COLORS[(selectedAreas.length + compareAreas.length) % AREA_COLORS.length];
                setCompareAreas((prev) => [...prev, { id: key, label, color, cityName, cityState: stateCode }]);
                setShowCompareInput(false);
                return;
            }

            const postcodeCtx = feature.context?.find((c) => c.id.startsWith("postcode."))?.text;
            const zip = feature.id.startsWith("postcode") ? feature.text : (postcodeCtx ?? null);
            if (!zip) return;
            if (allAreas.find((a) => a.id === zip)) return;
            const placeCtx = feature.context?.find((c) => c.id.startsWith("place."))?.text;
            const label = placeCtx ? `${zip} · ${placeCtx}` : zip;
            const color = AREA_COLORS[(selectedAreas.length + compareAreas.length) % AREA_COLORS.length];
            setCompareAreas((prev) => [...prev, { id: zip, label, color }]);
            setShowCompareInput(false);
        },
        [areaType, selectedAreas, compareAreas],
    );

    const selectCompareNeighborhood = useCallback(
        (nh: NeighborhoodResult) => {
            setCompareAddress("");
            setCompareNhSuggestions([]);
            setShowCompareSuggestions(false);
            const key = `nh:${nh.id}`;
            const allAreas = [...selectedAreas, ...compareAreas];
            if (allAreas.find((a) => a.id === key)) return;
            const label = `${nh.name} · ${nh.city}`;
            const color = AREA_COLORS[(selectedAreas.length + compareAreas.length) % AREA_COLORS.length];
            setCompareAreas((prev) => [...prev, { id: key, label, color, neighborhoodId: nh.id }]);
            setShowCompareInput(false);
        },
        [selectedAreas, compareAreas],
    );

    const selectCompareMsa = useCallback(
        (msa: { id: number; name: string; name_lsad: string; geoid: string }) => {
            setCompareAddress("");
            setCompareMsaSuggestions([]);
            setShowCompareSuggestions(false);
            setCompareActiveSuggestionIndex(-1);
            const key = `msa:${msa.geoid}`;
            const allAreas = [...selectedAreas, ...compareAreas];
            if (allAreas.find((a) => a.id === key)) return;
            const color = AREA_COLORS[(selectedAreas.length + compareAreas.length) % AREA_COLORS.length];
            setCompareAreas((prev) => [...prev, { id: key, label: msa.name, color, msaGeoid: msa.geoid }]);
            setShowCompareInput(false);
        },
        [selectedAreas, compareAreas],
    );

    const removeArea = (id: string) => {
        setSelectedAreas((prev) => prev.filter((a) => a.id !== id));
        setSalesResults((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const removeCompareArea = (id: string) => {
        setCompareAreas((prev) => prev.filter((a) => a.id !== id));
        setSalesResults((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const unitRange = useMemo((): { p_min_units?: number; p_max_units?: number } => {
        const PRESET_RANGES: Record<string, { min?: number; max?: number }> = {
            "2-4": { min: 2, max: 4 },
            "5-10": { min: 5, max: 10 },
            "11-25": { min: 11, max: 25 },
            "26-50": { min: 26, max: 50 },
            "51+": { min: 51 },
        };
        if (unitFilter === "All") return {};
        if (unitFilter === "custom") {
            const result: { p_min_units?: number; p_max_units?: number } = {};
            if (unitMin) result.p_min_units = parseInt(unitMin, 10);
            if (unitMax) result.p_max_units = parseInt(unitMax, 10);
            return result;
        }
        const preset = PRESET_RANGES[unitFilter];
        if (!preset) return {};
        const result: { p_min_units?: number; p_max_units?: number } = {};
        if (preset.min) result.p_min_units = preset.min;
        if (preset.max) result.p_max_units = preset.max;
        return result;
    }, [unitFilter, unitMin, unitMax]);

    // Fetch sales data
    useEffect(() => {
        const allAreas = [...selectedAreas, ...compareAreas];
        if (allAreas.length === 0) {
            setSalesResults({});
            return;
        }
        setLoading(true);

        const fetchSales = (area: AreaSelection): Promise<SalesTrendRowV2[]> => {
            const isNh = area.neighborhoodId != null;
            const isCity = area.cityName != null;
            const isCounty = area.countyName != null;
            const isMsa = area.msaGeoid != null;
            const call = isNh
                ? getCrexiSalesTrendsByNeighborhoodV2({
                      p_neighborhood_ids: [area.neighborhoodId!],
                      ...unitRange,
                  })
                : isCity
                  ? getCrexiSalesTrendsByCityV2({
                        p_city: area.cityName!,
                        p_state: area.cityState!,
                        ...unitRange,
                    })
                  : isCounty
                    ? getCrexiSalesTrendsByCountyV2({
                          p_county_name: area.countyName!,
                          p_state: area.countyState!,
                          ...unitRange,
                      })
                    : isMsa
                      ? getCrexiSalesTrendsByMsaV2({ p_geoid: area.msaGeoid!, ...unitRange })
                      : getCrexiSalesTrendsV2({ p_zip: area.id, ...unitRange });
            return call.catch(() => [] as SalesTrendRowV2[]);
        };

        Promise.all(allAreas.map((area) => fetchSales(area).then((rows) => ({ id: area.id, rows })))).then((results) => {
            setLoading(false);
            const next: Record<string, SalesTrendRowV2[]> = {};
            for (const r of results) next[r.id] = r.rows;
            setSalesResults(next);
        });
    }, [selectedAreas, compareAreas, unitRange]);

    const allDisplayAreas = useMemo(() => [...selectedAreas, ...compareAreas], [selectedAreas, compareAreas]);

    useEffect(() => {
        if (!bucketListingsOpen || !bucketModalAreaId || !bucketModalMonth) return;

        const area = allDisplayAreas.find((a) => a.id === bucketModalAreaId);
        const aq = area && areaKindAndQuery(area, areaType);
        if (!area || !aq) {
            setListingsError("Could not load listings for this area.");
            setListingsLoading(false);
            return;
        }

        const controller = new AbortController();
        setListingsLoading(true);
        setListingsError(null);

        const u = new URL("/api/analytics/crexi-sales-bucket-listings", typeof window !== "undefined" ? window.location.origin : "http://localhost");
        u.searchParams.set("areaKind", aq.areaKind);
        u.searchParams.set("bucketStart", bucketModalMonth);
        u.searchParams.set("monthsPerBucket", String(monthsPerSampleWindow(sampleComps)));
        u.searchParams.set("offset", String(listingsPage * LISTINGS_PAGE_SIZE));
        u.searchParams.set("limit", String(LISTINGS_PAGE_SIZE));
        if (aq.query.zip) u.searchParams.set("zip", aq.query.zip);
        if (aq.query.neighborhoodIds) u.searchParams.set("neighborhoodIds", aq.query.neighborhoodIds);
        if (aq.query.geoid) u.searchParams.set("geoid", aq.query.geoid);
        if (aq.query.countyName) u.searchParams.set("countyName", aq.query.countyName);
        if (aq.query.state) u.searchParams.set("state", aq.query.state);
        if (aq.query.city) u.searchParams.set("city", aq.query.city);
        if (unitRange.p_min_units != null) u.searchParams.set("minUnits", String(unitRange.p_min_units));
        if (unitRange.p_max_units != null) u.searchParams.set("maxUnits", String(unitRange.p_max_units));

        fetch(u.toString(), { signal: controller.signal })
            .then(async (res) => {
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
                return body as { listings: CrexiBucketListingRow[]; total: number };
            })
            .then((body) => {
                setListingsRows(body.listings ?? []);
                setListingsTotal(body.total ?? 0);
            })
            .catch((err: unknown) => {
                if (err instanceof Error && err.name === "AbortError") return;
                setListingsError(err instanceof Error ? err.message : "Failed to load listings");
                setListingsRows([]);
                setListingsTotal(0);
            })
            .finally(() => {
                if (!controller.signal.aborted) setListingsLoading(false);
            });

        return () => controller.abort();
    }, [bucketListingsOpen, bucketModalAreaId, bucketModalMonth, listingsPage, areaType, sampleComps, unitRange, allDisplayAreas]);
    const showVolume = selectedAreas.length === 1 && compareAreas.length === 0;

    const chartData = useMemo(() => {
        const allAreas = [...selectedAreas, ...compareAreas];
        if (allAreas.length === 0) return [];
        const allBuckets = new Set<string>();
        const processed: Record<string, SalesTrendRowV2[]> = {};
        for (const area of allAreas) {
            const raw = salesResults[area.id] ?? [];
            const filtered = filterByPeriod(raw, period);
            const aggregated = aggregateBySampleWindow(filtered, sampleComps);
            processed[area.id] = aggregated;
            aggregated.forEach((r) => allBuckets.add(r.month_start));
        }
        return Array.from(allBuckets)
            .sort()
            .map((bucket) => {
                const point: Record<string, string | number | [number, number]> = {
                    month: bucket,
                    monthLabel: formatMonthLabel(bucket),
                };
                for (const area of allAreas) {
                    const row = processed[area.id]?.find((r) => r.month_start === bucket);
                    if (row) {
                        const val = metricValue(row, metric, displayType);
                        if (val != null) point[area.id] = val;
                        if (
                            displayType === "Candle" &&
                            metric === "cost_per_unit" &&
                            row.median_price != null &&
                            row.p25_price != null &&
                            row.p75_price != null
                        ) {
                            const med = row.median_price;
                            point[`${area.id}_rangeErr`] = [med - row.p25_price, row.p75_price - med];
                        }
                        if (showVolume) point.volume = row.listing_count;
                    }
                }
                return point;
            });
    }, [salesResults, selectedAreas, compareAreas, period, sampleComps, metric, displayType, showVolume]);

    const hasData = chartData.length > 0;

    const openBucketListings = useCallback((areaId: string, monthKey: string) => {
        setBucketModalAreaId(areaId);
        setBucketModalMonth(monthKey);
        setListingsPage(0);
        setBucketListingsOpen(true);
    }, []);

    const handleChartClick = useCallback(
        (state: { activeLabel?: string | number; activeTooltipIndex?: number; activeIndex?: number; activeDataKey?: string | number }) => {
            // Recharts 3 often leaves activeDataKey undefined on chart click (see mouseClickMiddleware TODO).
            const idx = typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : state.activeIndex;
            if (typeof idx !== "number" || idx < 0) return;
            const pt = chartData[idx];
            if (!pt || typeof pt.month !== "string") return;

            let areaId: string | undefined;
            const dk = state.activeDataKey;
            if (typeof dk === "string" && dk !== "volume" && dk !== "month" && dk !== "monthLabel" && !dk.endsWith("_rangeErr") && pt[dk] !== undefined) {
                areaId = dk;
            } else {
                for (const a of allDisplayAreas) {
                    if (pt[a.id] !== undefined) {
                        areaId = a.id;
                        break;
                    }
                }
            }
            if (!areaId) return;
            openBucketListings(areaId, pt.month);
        },
        [chartData, allDisplayAreas, openBucketListings],
    );

    const searchPlaceholder = getTrendsSearchPlaceholder(areaType, false);

    const CustomTooltip = ({
        active,
        payload,
        label,
    }: {
        active?: boolean;
        payload?: Array<{
            dataKey: string;
            name: string;
            color: string;
            value: number;
        }>;
        label?: string;
    }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <p className="mb-1 text-gray-500">{label}</p>
                {payload.map((entry) => (
                    <div key={entry.dataKey} className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            {entry.dataKey === "volume" ? entry.value.toLocaleString() : formatMetricValue(entry.value, metric)}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="mx-auto w-full max-w-7xl flex-1 overflow-auto p-6">
            {/* Filter panel */}
            <div className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                {/* Row 1: Area type */}
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="shrink-0 text-sm text-gray-500 sm:w-24 dark:text-gray-400">Area</span>
                    <Select
                        value={areaType}
                        onValueChange={(v) => {
                            const t = v as AreaType;
                            setAreaType(t);
                            setSelectedAreas([]);
                            setCompareAreas([]);
                            setAddress("");
                            setSuggestions([]);
                            setNhSuggestions([]);
                            setMsaSuggestions([]);
                        }}
                    >
                        <SelectTrigger size="sm" className="min-w-[10rem]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {AREA_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {t}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Row 2: Period */}
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="shrink-0 text-sm text-gray-500 sm:w-24 dark:text-gray-400">Period</span>
                    <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                        <SelectTrigger size="sm" className="min-w-[6rem]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PERIOD_OPTIONS.map((p) => (
                                <SelectItem key={p} value={p}>
                                    {p}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Row 3: Sample Comps */}
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="shrink-0 text-sm text-gray-500 sm:w-24 dark:text-gray-400">Sample Comps</span>
                    <Select value={sampleComps} onValueChange={(v) => setSampleComps(v as SampleComps)}>
                        <SelectTrigger size="sm" className="min-w-[6rem]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SAMPLE_COMPS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Row 4: Sales Price display + Metric */}
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                    <div className="flex items-center gap-2">
                        <span className="shrink-0 text-sm text-gray-500 sm:w-24 dark:text-gray-400">Sales Price</span>
                        <Select value={displayType} onValueChange={(v) => setDisplayType(v as DisplayType)}>
                            <SelectTrigger size="sm" className="min-w-[8rem]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DISPLAY_OPTIONS.map((d) => (
                                    <SelectItem key={d.value} value={d.value}>
                                        {d.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">Display</span>
                        <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
                            <SelectTrigger size="sm" className="min-w-[8rem]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {METRIC_OPTIONS.map((m) => (
                                    <SelectItem key={m.value} value={m.value} disabled={m.disabled}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Row 5: Area search */}
                <div className="flex items-start gap-4">
                    <span className="w-24 shrink-0 pt-2 text-sm text-gray-500 dark:text-gray-400">Search</span>
                    <div className="flex-1 space-y-2">
                        {selectedAreas.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedAreas.map((area) => (
                                    <span
                                        key={area.id}
                                        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                                        style={{
                                            borderColor: area.color,
                                            color: area.color,
                                            backgroundColor: `${area.color}14`,
                                        }}
                                    >
                                        <span
                                            className="size-1.5 shrink-0 rounded-full"
                                            style={{
                                                backgroundColor: area.color,
                                            }}
                                        />
                                        {area.label}
                                        <button type="button" onClick={() => removeArea(area.id)} className="ml-0.5 transition-opacity hover:opacity-60">
                                            <X className="size-3" />
                                        </button>
                                    </span>
                                ))}
                                {selectedAreas.length < MAX_TREND_AREAS && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddInput(true);
                                            setAddress("");
                                        }}
                                        className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-gray-600"
                                        title="Add area"
                                    >
                                        <span className="mb-px text-base leading-none">+</span>
                                    </button>
                                )}
                            </div>
                        )}
                        {(selectedAreas.length === 0 || showAddInput) && (
                            <div className="relative flex-1" ref={inputWrapperRef}>
                                <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder={searchPlaceholder}
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    onKeyDown={(e) => {
                                        const list = areaType === "Neighborhood" ? nhSuggestions : areaType === "MSA" ? msaSuggestions : suggestions;
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setActiveSuggestionIndex((i) => Math.min(i + 1, list.length - 1));
                                        } else if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setActiveSuggestionIndex((i) => Math.max(i - 1, 0));
                                        } else if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (activeSuggestionIndex >= 0) {
                                                if (areaType === "Neighborhood") selectNeighborhood(nhSuggestions[activeSuggestionIndex]);
                                                else if (areaType === "MSA") selectMsa(msaSuggestions[activeSuggestionIndex]);
                                                else selectSuggestion(suggestions[activeSuggestionIndex]);
                                                setActiveSuggestionIndex(-1);
                                            }
                                        } else if (e.key === "Escape") {
                                            setShowSuggestions(false);
                                            if (selectedAreas.length > 0) {
                                                setShowAddInput(false);
                                                setAddress("");
                                            }
                                        }
                                    }}
                                    onFocus={() =>
                                        (suggestions.length > 0 || nhSuggestions.length > 0 || msaSuggestions.length > 0) && setShowSuggestions(true)
                                    }
                                    className="pl-9"
                                    autoComplete="off"
                                    autoFocus={showAddInput}
                                />
                                {showSuggestions && areaType === "Neighborhood" && nhSuggestions.length > 0 && (
                                    <ul
                                        ref={suggestListRef}
                                        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        {nhSuggestions.map((nh, i) => (
                                            <li key={nh.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectNeighborhood(nh);
                                                    }}
                                                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors ${i === activeSuggestionIndex ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                                                >
                                                    <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-gray-400" />
                                                    <span className="leading-snug text-gray-800 dark:text-gray-200">
                                                        {nh.name} · {nh.city}, {nh.state}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {showSuggestions && areaType === "MSA" && msaSuggestions.length > 0 && (
                                    <ul
                                        ref={suggestListRef}
                                        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        {msaSuggestions.map((msa, i) => (
                                            <li key={msa.geoid}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectMsa(msa);
                                                    }}
                                                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors ${i === activeSuggestionIndex ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                                                >
                                                    <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-gray-400" />
                                                    <span className="leading-snug text-gray-800 dark:text-gray-200">{msa.name_lsad}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {showSuggestions && areaType !== "Neighborhood" && areaType !== "MSA" && suggestions.length > 0 && (
                                    <ul
                                        ref={suggestListRef}
                                        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        {suggestions.map((feature, i) => (
                                            <li key={feature.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectSuggestion(feature);
                                                    }}
                                                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors ${i === activeSuggestionIndex ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                                                >
                                                    <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-gray-400" />
                                                    <span className="leading-snug text-gray-800 dark:text-gray-200">{feature.place_name}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 6: # of Units */}
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="shrink-0 text-sm text-gray-500 sm:w-24 dark:text-gray-400"># of Units</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Select
                            value={unitFilter}
                            onValueChange={(v) => {
                                const next = v as UnitFilter;
                                setUnitFilter(next);
                                if (next === "All") {
                                    setUnitMin("");
                                    setUnitMax("");
                                } else if (next !== "custom") {
                                    setUnitMin("");
                                    setUnitMax("");
                                }
                            }}
                        >
                            <SelectTrigger size="sm" className="min-w-[8rem]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {UNIT_PRESETS.map((u) => (
                                    <SelectItem key={u.value} value={u.value}>
                                        {u.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400 dark:text-gray-500">Min</span>
                            <input
                                type="number"
                                value={unitMin}
                                onChange={(e) => {
                                    setUnitMin(e.target.value);
                                    if (e.target.value || unitMax) setUnitFilter("custom");
                                    else setUnitFilter("All");
                                }}
                                className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                placeholder="—"
                            />
                            <span className="text-gray-400 dark:text-gray-500">Max</span>
                            <input
                                type="number"
                                value={unitMax}
                                onChange={(e) => {
                                    setUnitMax(e.target.value);
                                    if (e.target.value || unitMin) setUnitFilter("custom");
                                    else setUnitFilter("All");
                                }}
                                className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                                placeholder="—"
                            />
                        </div>
                    </div>
                </div>

                {/* Row 7: Compare */}
                <div className="flex items-start gap-4">
                    <span className="w-24 shrink-0 pt-2 text-sm text-gray-500 dark:text-gray-400">Compare</span>
                    <div className="flex-1 space-y-2">
                        <p className="text-xs text-gray-400 dark:text-gray-500">Search a {areaType.toLowerCase()} to compare with the selected area</p>
                        {compareAreas.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {compareAreas.map((area) => (
                                    <span
                                        key={area.id}
                                        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                                        style={{
                                            borderColor: area.color,
                                            color: area.color,
                                            backgroundColor: `${area.color}14`,
                                        }}
                                    >
                                        <span
                                            className="size-1.5 shrink-0 rounded-full"
                                            style={{
                                                backgroundColor: area.color,
                                            }}
                                        />
                                        {area.label}
                                        <button type="button" onClick={() => removeCompareArea(area.id)} className="ml-0.5 transition-opacity hover:opacity-60">
                                            <X className="size-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        {(compareAreas.length === 0 || showCompareInput) && (
                            <div className="relative flex-1" ref={compareInputWrapperRef}>
                                <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder={`Search ${areaType.toLowerCase()} to compare…`}
                                    value={compareAddress}
                                    onChange={(e) => setCompareAddress(e.target.value)}
                                    onKeyDown={(e) => {
                                        const list =
                                            areaType === "Neighborhood"
                                                ? compareNhSuggestions
                                                : areaType === "MSA"
                                                  ? compareMsaSuggestions
                                                  : compareSuggestions;
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setCompareActiveSuggestionIndex((i) => Math.min(i + 1, list.length - 1));
                                        } else if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setCompareActiveSuggestionIndex((i) => Math.max(i - 1, 0));
                                        } else if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (compareActiveSuggestionIndex >= 0) {
                                                if (areaType === "Neighborhood") selectCompareNeighborhood(compareNhSuggestions[compareActiveSuggestionIndex]);
                                                else if (areaType === "MSA") selectCompareMsa(compareMsaSuggestions[compareActiveSuggestionIndex]);
                                                else selectCompareSuggestion(compareSuggestions[compareActiveSuggestionIndex]);
                                                setCompareActiveSuggestionIndex(-1);
                                            }
                                        } else if (e.key === "Escape") {
                                            setShowCompareSuggestions(false);
                                            setShowCompareInput(false);
                                            setCompareAddress("");
                                        }
                                    }}
                                    onFocus={() =>
                                        (compareSuggestions.length > 0 || compareNhSuggestions.length > 0 || compareMsaSuggestions.length > 0) &&
                                        setShowCompareSuggestions(true)
                                    }
                                    className="pl-9"
                                    autoComplete="off"
                                    autoFocus={showCompareInput}
                                />
                                {showCompareSuggestions && areaType === "Neighborhood" && compareNhSuggestions.length > 0 && (
                                    <ul
                                        ref={compareSuggestListRef}
                                        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        {compareNhSuggestions.map((nh, i) => (
                                            <li key={nh.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectCompareNeighborhood(nh);
                                                    }}
                                                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors ${i === compareActiveSuggestionIndex ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                                                >
                                                    <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-gray-400" />
                                                    <span className="leading-snug text-gray-800 dark:text-gray-200">
                                                        {nh.name} · {nh.city}, {nh.state}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {showCompareSuggestions && areaType === "MSA" && compareMsaSuggestions.length > 0 && (
                                    <ul
                                        ref={compareSuggestListRef}
                                        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        {compareMsaSuggestions.map((msa, i) => (
                                            <li key={msa.geoid}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectCompareMsa(msa);
                                                    }}
                                                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors ${i === compareActiveSuggestionIndex ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                                                >
                                                    <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-gray-400" />
                                                    <span className="leading-snug text-gray-800 dark:text-gray-200">{msa.name_lsad}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {showCompareSuggestions && areaType !== "Neighborhood" && areaType !== "MSA" && compareSuggestions.length > 0 && (
                                    <ul
                                        ref={compareSuggestListRef}
                                        className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        {compareSuggestions.map((feature, i) => (
                                            <li key={feature.id}>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        selectCompareSuggestion(feature);
                                                    }}
                                                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors ${i === compareActiveSuggestionIndex ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                                                >
                                                    <MapPin className="mt-0.5 size-3.5 flex-shrink-0 text-gray-400" />
                                                    <span className="leading-snug text-gray-800 dark:text-gray-200">{feature.place_name}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                        {compareAreas.length > 0 && !showCompareInput && compareAreas.length < 4 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCompareInput(true);
                                    setCompareAddress("");
                                }}
                                className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-gray-600"
                                title="Add comparison area"
                            >
                                <span className="mb-px text-base leading-none">+</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Row 8: Rent Basis */}
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="shrink-0 text-sm text-gray-500 sm:w-24 dark:text-gray-400">Rent Basis</span>
                    <div className="flex items-center gap-2">
                        <Select value={rentBasis} onValueChange={(v) => setRentBasis(v as RentBasis)}>
                            <SelectTrigger size="sm" className="min-w-[10rem]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {RENT_BASIS_OPTIONS.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-600 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Coming soon
                        </span>
                    </div>
                </div>
            </div>

            {/* Empty state */}
            {allDisplayAreas.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center dark:border-gray-700 dark:bg-gray-800">
                    <TrendingUp className="mb-3 size-10 text-gray-300" />
                    <p className="text-gray-500 dark:text-gray-400">Search a {areaType.toLowerCase()} above to see sales trend charts</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Add areas and use Compare to overlay trend lines</p>
                </div>
            )}

            {/* Loading */}
            {allDisplayAreas.length > 0 && loading && (
                <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-16 dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-sm text-gray-400">Loading…</p>
                </div>
            )}

            {/* Chart */}
            {allDisplayAreas.length > 0 && !loading && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                            {METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? "Sales"} — {displayType} · Closed Sales
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                            <span>Vertical Scale: {verticalScaleLabel(metric)}</span>
                            {showVolume && (
                                <span className="ml-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-600 dark:bg-gray-700">
                                    Volume ▶ right axis
                                </span>
                            )}
                        </div>
                    </div>

                    {!hasData && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <TrendingUp className="mb-3 size-10 text-gray-300" />
                            <p className="text-gray-500 dark:text-gray-400">No sales data for the selected area and period</p>
                        </div>
                    )}

                    {hasData && (
                        <>
                            {/* Legend */}
                            <div className="mb-4 flex flex-wrap items-center gap-4">
                                {allDisplayAreas.map((area) => (
                                    <div key={area.id} className="flex items-center gap-1.5">
                                        <span
                                            className="size-2 shrink-0 rounded-full"
                                            style={{
                                                backgroundColor: area.color,
                                            }}
                                        />
                                        <span className="text-xs text-gray-600 dark:text-gray-400">{area.label}</span>
                                    </div>
                                ))}
                            </div>

                            <ResponsiveContainer width="100%" height={340}>
                                <ComposedChart
                                    data={chartData}
                                    onClick={(state) =>
                                        handleChartClick(
                                            state as {
                                                activeTooltipIndex?: number;
                                                activeDataKey?: string | number;
                                            },
                                        )
                                    }
                                    margin={{
                                        top: 5,
                                        right: showVolume ? 60 : 20,
                                        left: 10,
                                        bottom: 5,
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="monthLabel"
                                        tick={{
                                            fontSize: 12,
                                            fill: "#6b7280",
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        tickFormatter={(v: number) => formatYAxisValue(v, metric)}
                                        tick={{
                                            fontSize: 12,
                                            fill: "#6b7280",
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={75}
                                    />
                                    {showVolume && (
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            tickFormatter={(v: number) => v.toLocaleString()}
                                            tick={{
                                                fontSize: 12,
                                                fill: "#9ca3af",
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={50}
                                        />
                                    )}
                                    <Tooltip content={<CustomTooltip />} />
                                    {showVolume && <Bar yAxisId="right" dataKey="volume" name="Volume" fill="#d1d5db" opacity={0.5} barSize={20} />}
                                    {allDisplayAreas.map((area) => (
                                        <Line
                                            key={area.id}
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey={area.id}
                                            name={area.label}
                                            stroke={area.color}
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            connectNulls
                                        >
                                            {displayType === "Candle" && metric === "cost_per_unit" && (
                                                <ErrorBar
                                                    dataKey={`${area.id}_rangeErr`}
                                                    width={4}
                                                    stroke={area.color}
                                                    strokeWidth={1.5}
                                                    direction="y"
                                                    isAnimationActive={false}
                                                />
                                            )}
                                        </Line>
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>

                            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                                {metric === "cap_rate" &&
                                    `Average cap rate from Crexi closed sales comps. Period: ${period}, Sample: ${sampleComps}.${unitFilter !== "All" ? ` Units: ${unitFilter}.` : ""}`}
                                {metric === "cost_per_unit" &&
                                    `${displayType === "Average" ? "Average" : displayType === "Candle" ? "P25–P75 range with median" : "Median"} closed-sale price per door from Crexi API comps. Period: ${period}, Sample: ${sampleComps}.${unitFilter !== "All" ? ` Units: ${unitFilter}.` : ""}`}
                            </p>
                            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Click a point on a series to open the comps for that period.</p>
                        </>
                    )}
                </div>
            )}

            <Dialog
                open={bucketListingsOpen}
                onOpenChange={(open) => {
                    setBucketListingsOpen(open);
                    if (!open) {
                        setBucketModalAreaId(null);
                        setBucketModalMonth(null);
                        setListingsPage(0);
                        setListingsRows([]);
                        setListingsTotal(0);
                        setListingsError(null);
                    }
                }}
            >
                <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            Crexi comps — {bucketModalAreaId ? (allDisplayAreas.find((a) => a.id === bucketModalAreaId)?.label ?? bucketModalAreaId) : ""}
                            {bucketModalMonth ? ` · ${formatMonthLabel(bucketModalMonth)}` : ""}{" "}
                            <span className="font-normal text-gray-500">({sampleComps} window)</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex max-h-[min(60vh,520px)] flex-col overflow-hidden">
                        {listingsLoading && <p className="text-sm text-gray-500">Loading…</p>}
                        {listingsError && <p className="text-sm text-red-600">{listingsError}</p>}
                        {!listingsLoading && !listingsError && listingsRows.length === 0 && (
                            <p className="text-sm text-gray-500">No comps in this bucket for the current filters.</p>
                        )}
                        {!listingsLoading && listingsRows.length > 0 && (
                            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                <table className="w-full text-left text-sm">
                                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/80">
                                        <tr>
                                            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Sale date</th>
                                            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Property</th>
                                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Price</th>
                                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Units</th>
                                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">$/door</th>
                                            <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Cap</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {listingsRows.map((row) => {
                                            const cap = row.sale_cap_rate_percent != null ? row.sale_cap_rate_percent : row.financials_cap_rate_percent;
                                            return (
                                                <tr key={row.id} className="bg-white dark:bg-gray-800">
                                                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                        {row.sale_transaction_date ? String(row.sale_transaction_date).slice(0, 10) : "—"}
                                                    </td>
                                                    <td className="max-w-[220px] px-3 py-2 text-gray-800 dark:text-gray-200">
                                                        <span className="line-clamp-2">{row.property_name?.trim() || row.address_full?.trim() || "—"}</span>
                                                        {(row.city || row.state) && (
                                                            <span className="mt-0.5 block text-xs text-gray-500">
                                                                {[row.city, row.state, row.zip].filter(Boolean).join(", ")}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        {row.property_price_total != null ? formatUsd0(row.property_price_total) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        {row.num_units != null ? row.num_units.toLocaleString() : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        {row.price_per_door != null ? formatUsd0(row.price_per_door) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        {cap != null ? `${Number(cap).toFixed(2)}%` : "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {listingsTotal > LISTINGS_PAGE_SIZE && (
                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                                <p className="text-xs text-gray-500">
                                    {listingsTotal.toLocaleString()} total · page {listingsPage + 1} of{" "}
                                    {Math.max(1, Math.ceil(listingsTotal / LISTINGS_PAGE_SIZE))}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={listingsPage <= 0 || listingsLoading}
                                        onClick={() => setListingsPage((p) => Math.max(0, p - 1))}
                                        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        type="button"
                                        disabled={listingsLoading || listingsPage >= Math.ceil(listingsTotal / LISTINGS_PAGE_SIZE) - 1}
                                        onClick={() => setListingsPage((p) => p + 1)}
                                        className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
