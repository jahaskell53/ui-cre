"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart2, Map, MapPin, Search, Table2, TrendingUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
    getMarketActivity,
    getMarketActivityByCity,
    getMarketActivityByCounty,
    getMarketActivityByMsa,
    getMarketActivityByNeighborhood,
    getMsaAtPoint,
    getNeighborhoodAtPoint,
    getRentTrends,
    getRentTrendsByCity,
    getRentTrendsByCounty,
    getRentTrendsByMsa,
    getRentTrendsByNeighborhood,
    getSalesTrends,
    getSalesTrendsByCity,
    getSalesTrendsByCounty,
    getSalesTrendsByMsa,
    getSalesTrendsByNeighborhood,
    searchMsas,
    searchNeighborhoods,
} from "@/db/rpc";
import {
    MAX_TREND_AREAS,
    buildDisplayAreaResults,
    buildDisplayAreas,
    getTrendsSearchPlaceholder,
    parseSerializedAreas,
    serializeAreasParam,
} from "@/lib/analytics/trends-page";
import { MarketActivitySection } from "./market-activity-section";
import { RentTrendsSection } from "./rent-trends-section";
import { SalesStatsTile, SalesTrendsSection } from "./sales-trends-section";
import { TrendsTableSection } from "./trends-table-section";
import { AREA_COLORS, ActivityRow, AreaSelection, BED_DASH, BED_KEYS, SalesTrendRow, TrendRow, formatDollars, pctChange } from "./trends-utils";
import { ZipTrendsMap } from "./zip-trends-map";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

type DataTab = "rent" | "sales";

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

const AREA_TYPES = ["Neighborhood", "ZIP Code", "City", "County", "MSA"];
const ENABLED_AREA_TYPES = new Set(["ZIP Code", "Neighborhood", "City", "County", "MSA"]);
const MAP_AREA_TYPES = new Set(["ZIP Code", "Neighborhood", "City", "County", "MSA"]);

interface AreaResult {
    trends: TrendRow[];
    activity: ActivityRow[];
}

export default function TrendsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [dataTab, setDataTab] = useState<DataTab>((searchParams.get("dataTab") as DataTab) ?? "rent");

    const [address, setAddress] = useState("");
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [nhSuggestions, setNhSuggestions] = useState<NeighborhoodResult[]>([]);
    const [msaSuggestions, setMsaSuggestions] = useState<{ id: number; name: string; name_lsad: string; geoid: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [areaType, setAreaType] = useState<string>(searchParams.get("areaType") ?? "ZIP Code");
    const [addressMode, setAddressMode] = useState(false);
    const [pendingFeature, setPendingFeature] = useState<MapboxFeature | null>(null);
    const [pendingNh, setPendingNh] = useState<{ id: number; name: string; city: string } | null | "loading">(null);
    const [pendingMsa, setPendingMsa] = useState<{ geoid: string; name: string } | null | "loading">(null);
    const prevAreaTypeRef = useRef<string>(searchParams.get("areaType") ?? "ZIP Code");
    const lastAddressFeatureRef = useRef<MapboxFeature | null>(null);
    const lastAddressAreaIdRef = useRef<string | null>(null);

    const [display, setDisplay] = useState<"chart" | "table" | "map">((searchParams.get("display") as "chart" | "table" | "map") ?? "chart");
    const [selectedAreas, setSelectedAreas] = useState<AreaSelection[]>(() => parseSerializedAreas(searchParams.get("areas")));
    const [areaResults, setAreaResults] = useState<Record<string, AreaResult>>({});
    const [salesResults, setSalesResults] = useState<Record<string, SalesTrendRow[]>>({});
    const [showAddInput, setShowAddInput] = useState(false);

    const [selectedBeds, setSelectedBeds] = useState<number[]>(() => {
        const raw = searchParams.get("beds");
        if (!raw) return [1];
        const parsed = raw
            .split(",")
            .map(Number)
            .filter((n) => !isNaN(n));
        return parsed.length > 0 ? parsed : [1];
    });
    const [selectedSegment, setSelectedSegment] = useState<"both" | "mid" | "reit">(() => {
        const raw = searchParams.get("segment");
        if (raw === "both" || raw === "reit") return raw;
        return "mid";
    });
    const [loading, setLoading] = useState(false);
    const [salesLoading, setSalesLoading] = useState(false);

    // Sync persisted state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("dataTab", dataTab);
        params.set("areaType", areaType);
        params.set("display", display);
        params.set("beds", selectedBeds.join(","));
        params.set("segment", selectedSegment);
        if (selectedAreas.length > 0) params.set("areas", serializeAreasParam(selectedAreas));
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [dataTab, areaType, display, selectedAreas, selectedBeds, selectedSegment]); // eslint-disable-line react-hooks/exhaustive-deps

    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const suggestListRef = useRef<HTMLUListElement>(null);
    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suggestAbortRef = useRef<AbortController | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const userCoordsRef = useRef<{ lng: number; lat: number } | null>(null);

    // Get user location once for proximity bias
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoordsRef.current = { lng: pos.coords.longitude, lat: pos.coords.latitude };
            },
            () => {
                /* permission denied — no proximity bias */
            },
        );
    }, []);

    // Autocomplete
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
            if (areaType === "MSA" && !addressMode) {
                try {
                    const proximity = userCoordsRef.current ?? undefined;
                    const data = await searchMsas({ p_query: address, p_lat: proximity?.lat, p_lng: proximity?.lng }, { signal: controller.signal });
                    if (!cancelled) {
                        setMsaSuggestions(data);
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") return;
                    if (!cancelled) setMsaSuggestions([]);
                }
            } else if (areaType === "Neighborhood" && !addressMode) {
                try {
                    const proximity = userCoordsRef.current ?? undefined;
                    const data = await searchNeighborhoods({ p_query: address, p_lat: proximity?.lat, p_lng: proximity?.lng }, { signal: controller.signal });
                    if (!cancelled) {
                        setNhSuggestions(data);
                        setShowSuggestions(true);
                    }
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") return;
                    if (!cancelled) setNhSuggestions([]);
                }
            } else {
                try {
                    const types = addressMode
                        ? "address"
                        : areaType === "ZIP Code"
                          ? "postcode"
                          : areaType === "City"
                            ? "place"
                            : areaType === "County"
                              ? "district"
                              : "address";
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
                } catch (error) {
                    if (error instanceof Error && error.name === "AbortError") return;
                    if (!cancelled) setSuggestions([]);
                }
            }
        }, 180);

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [address, areaType, addressMode]);

    // Scroll active suggestion into view
    useEffect(() => {
        if (activeSuggestionIndex < 0 || !suggestListRef.current) return;
        const item = suggestListRef.current.children[activeSuggestionIndex] as HTMLElement | undefined;
        item?.scrollIntoView({ block: "nearest" });
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

    // Resolve neighborhood + MSA names when a pending address is selected
    useEffect(() => {
        if (!pendingFeature) {
            setPendingNh(null);
            setPendingMsa(null);
            return;
        }
        const [lng, lat] = pendingFeature.center;
        setPendingNh("loading");
        setPendingMsa("loading");
        getNeighborhoodAtPoint({ p_lat: lat, p_lng: lng })
            .then((rows) => setPendingNh(rows[0] ?? null))
            .catch(() => setPendingNh(null));
        getMsaAtPoint({ p_lat: lat, p_lng: lng })
            .then((rows) => setPendingMsa(rows[0] ?? null))
            .catch(() => setPendingMsa(null));
    }, [pendingFeature]);

    // Fetch rent data when areas or rent filters change
    useEffect(() => {
        if (selectedAreas.length === 0) {
            setAreaResults({});
            return;
        }
        setLoading(true);

        const fetchTrends = (area: AreaSelection, beds: number, reitsOnly: boolean) => {
            const isNh = area.neighborhoodId != null;
            const isCity = area.cityName != null;
            const isCounty = area.countyName != null;
            const isMsa = area.msaGeoid != null;
            const p = { p_beds: beds, p_reits_only: reitsOnly, p_home_type: null };
            const call = isNh
                ? getRentTrendsByNeighborhood({ p_neighborhood_ids: [area.neighborhoodId!], ...p })
                : isCity
                  ? getRentTrendsByCity({ p_city: area.cityName!, p_state: area.cityState!, ...p })
                  : isCounty
                    ? getRentTrendsByCounty({ p_county_name: area.countyName!, p_state: area.countyState!, ...p })
                    : isMsa
                      ? getRentTrendsByMsa({ p_geoid: area.msaGeoid!, ...p })
                      : getRentTrends({ p_zip: area.id, ...p });
            return call
                .then((data) => data as TrendRow[])
                .catch((error) => {
                    console.error(error);
                    return [] as TrendRow[];
                });
        };

        const fetchActivity = (area: AreaSelection, reitsOnly: boolean) => {
            const isNh = area.neighborhoodId != null;
            const isCity = area.cityName != null;
            const isCounty = area.countyName != null;
            const isMsa = area.msaGeoid != null;
            const ht = { p_home_type: null };
            const call = isNh
                ? getMarketActivityByNeighborhood({ p_neighborhood_ids: [area.neighborhoodId!], p_reits_only: reitsOnly, ...ht })
                : isCity
                  ? getMarketActivityByCity({ p_city: area.cityName!, p_state: area.cityState!, p_reits_only: reitsOnly, ...ht })
                  : isCounty
                    ? getMarketActivityByCounty({
                          p_county_name: area.countyName!,
                          p_state: area.countyState!,
                          p_reits_only: reitsOnly,
                          ...ht,
                      })
                    : isMsa
                      ? getMarketActivityByMsa({ p_geoid: area.msaGeoid!, p_reits_only: reitsOnly, ...ht })
                      : getMarketActivity({ p_zip: area.id, p_reits_only: reitsOnly, ...ht });
            return call
                .then((data) => data as ActivityRow[])
                .catch((error) => {
                    console.error(error);
                    return [] as ActivityRow[];
                });
        };

        const multiSource = selectedSegment === "both";
        const sourcesToFetch = multiSource
            ? [
                  { src: "mid" as const, reitsOnly: false },
                  { src: "reit" as const, reitsOnly: true },
              ]
            : [{ src: selectedSegment as "mid" | "reit", reitsOnly: selectedSegment === "reit" }];

        Promise.all(
            selectedAreas.flatMap((area) =>
                sourcesToFetch.map(({ src, reitsOnly: ro }) => {
                    const key = multiSource ? `${area.id}:${src}` : area.id;
                    return Promise.all([
                        Promise.all(selectedBeds.map((beds) => fetchTrends(area, beds, ro))).then((r) => r.flat()),
                        fetchActivity(area, ro),
                    ]).then(([trends, activity]) => ({ key, trends, activity }));
                }),
            ),
        ).then((results) => {
            setLoading(false);
            const next: Record<string, AreaResult> = {};
            for (const r of results) {
                next[r.key] = { trends: r.trends, activity: r.activity };
            }
            setAreaResults(next);
        });
    }, [selectedAreas, selectedBeds, selectedSegment]);

    // Fetch sales data when areas or property type change
    useEffect(() => {
        if (selectedAreas.length === 0) {
            setSalesResults({});
            return;
        }
        setSalesLoading(true);

        const fetchSales = (area: AreaSelection): Promise<SalesTrendRow[]> => {
            const isNh = area.neighborhoodId != null;
            const isCity = area.cityName != null;
            const isCounty = area.countyName != null;
            const isMsa = area.msaGeoid != null;
            const call = isNh
                ? getSalesTrendsByNeighborhood({ p_neighborhood_ids: [area.neighborhoodId!] })
                : isCity
                  ? getSalesTrendsByCity({ p_city: area.cityName!, p_state: area.cityState! })
                  : isCounty
                    ? getSalesTrendsByCounty({ p_county_name: area.countyName!, p_state: area.countyState! })
                    : isMsa
                      ? getSalesTrendsByMsa({ p_geoid: area.msaGeoid! })
                      : getSalesTrends({ p_zip: area.id });
            return call.catch((error) => {
                console.error(error);
                return [] as SalesTrendRow[];
            });
        };

        Promise.all(selectedAreas.map((area) => fetchSales(area).then((rows) => ({ id: area.id, rows })))).then((results) => {
            setSalesLoading(false);
            const next: Record<string, SalesTrendRow[]> = {};
            for (const r of results) next[r.id] = r.rows;
            setSalesResults(next);
        });
    }, [selectedAreas]);

    const selectSuggestion = (feature: MapboxFeature) => {
        setAddress("");
        setSuggestions([]);
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);

        if (addressMode) {
            setPendingFeature(feature);
            return;
        }

        if (areaType === "County") {
            const countyName = feature.text;
            const regionCtx = feature.context?.find((c) => c.id.startsWith("region."));
            const shortCode = (regionCtx as typeof regionCtx & { short_code?: string })?.short_code ?? "";
            const stateCode = shortCode.replace("US-", "");
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
            const shortCode = (regionCtx as typeof regionCtx & { short_code?: string })?.short_code ?? "";
            const stateCode = shortCode.replace("US-", "");
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
    };

    const cancelAddressMode = () => {
        setAddressMode(false);
        setPendingFeature(null);
        lastAddressFeatureRef.current = null;
        lastAddressAreaIdRef.current = null;
        setAddress("");
        setSuggestions([]);
        setAreaType(prevAreaTypeRef.current);
        setShowAddInput(selectedAreas.length > 0 ? false : false);
    };

    const resolveGranularity = async (granularity: string, featureOverride?: MapboxFeature) => {
        const feature = featureOverride ?? pendingFeature;
        if (!feature) return;
        lastAddressFeatureRef.current = feature;
        setPendingFeature(null);
        setAddressMode(false);
        setShowAddInput(false);
        setAreaType(granularity);

        const replaceId = featureOverride ? lastAddressAreaIdRef.current : null;
        const replaceArea = replaceId ? selectedAreas.find((a) => a.id === replaceId) : null;
        const color = replaceArea?.color ?? AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        const applyArea = (id: string, area: AreaSelection) => {
            lastAddressAreaIdRef.current = id;
            if (replaceId) {
                setSelectedAreas((prev) => prev.map((a) => (a.id === replaceId ? area : a)));
                setAreaResults((prev) => {
                    const next = { ...prev };
                    if (replaceId !== id) delete next[replaceId];
                    return next;
                });
                setSalesResults((prev) => {
                    const next = { ...prev };
                    if (replaceId !== id) delete next[replaceId];
                    return next;
                });
            } else {
                setSelectedAreas((prev) => [...prev, area]);
            }
        };

        const removeOldIfReplacing = () => {
            if (replaceId) {
                setSelectedAreas((prev) => prev.filter((a) => a.id !== replaceId));
                setAreaResults((prev) => {
                    const next = { ...prev };
                    delete next[replaceId];
                    return next;
                });
                setSalesResults((prev) => {
                    const next = { ...prev };
                    delete next[replaceId];
                    return next;
                });
            }
        };

        if (granularity === "ZIP Code") {
            const postcodeCtx = feature.context?.find((c) => c.id.startsWith("postcode."))?.text;
            const zip = feature.id.startsWith("postcode") ? feature.text : (postcodeCtx ?? null);
            if (!zip) {
                removeOldIfReplacing();
                return;
            }
            if (!replaceId && (selectedAreas.find((a) => a.id === zip) || selectedAreas.length >= MAX_TREND_AREAS)) return;
            const placeCtx = feature.context?.find((c) => c.id.startsWith("place."))?.text;
            const label = placeCtx ? `${zip} · ${placeCtx}` : zip;
            applyArea(zip, { id: zip, label, color });
        } else if (granularity === "City") {
            const cityName = feature.context?.find((c) => c.id.startsWith("place."))?.text ?? feature.text;
            const regionCtx = feature.context?.find((c) => c.id.startsWith("region."));
            const stateCode = ((regionCtx as typeof regionCtx & { short_code?: string })?.short_code ?? "").replace("US-", "");
            const key = `city:${cityName}:${stateCode}`;
            if (!replaceId && (selectedAreas.find((a) => a.id === key) || selectedAreas.length >= MAX_TREND_AREAS)) return;
            const label = stateCode ? `${cityName}, ${stateCode}` : cityName;
            applyArea(key, { id: key, label, color, cityName, cityState: stateCode });
        } else if (granularity === "County") {
            const countyName = feature.context?.find((c) => c.id.startsWith("district."))?.text;
            if (!countyName) {
                removeOldIfReplacing();
                return;
            }
            const regionCtx = feature.context?.find((c) => c.id.startsWith("region."));
            const stateCode = ((regionCtx as typeof regionCtx & { short_code?: string })?.short_code ?? "").replace("US-", "");
            const key = `county:${countyName}:${stateCode}`;
            if (!replaceId && (selectedAreas.find((a) => a.id === key) || selectedAreas.length >= MAX_TREND_AREAS)) return;
            const label = stateCode ? `${countyName}, ${stateCode}` : countyName;
            applyArea(key, { id: key, label, color, countyName, countyState: stateCode });
        } else if (granularity === "Neighborhood") {
            const [lng, lat] = feature.center;
            const rows = await getNeighborhoodAtPoint({ p_lat: lat, p_lng: lng });
            const nh = rows[0];
            if (!nh) {
                removeOldIfReplacing();
                return;
            }
            const key = `nh:${nh.id}`;
            if (!replaceId && (selectedAreas.find((a) => a.id === key) || selectedAreas.length >= MAX_TREND_AREAS)) return;
            applyArea(key, { id: key, label: `${nh.name} · ${nh.city}`, color, neighborhoodId: nh.id });
        } else if (granularity === "MSA") {
            const [lng, lat] = feature.center;
            const msaRows = await getMsaAtPoint({ p_lat: lat, p_lng: lng });
            const msa = msaRows[0];
            if (!msa) {
                removeOldIfReplacing();
                return;
            }
            const key = `msa:${msa.geoid}`;
            if (!replaceId && (selectedAreas.find((a) => a.id === key) || selectedAreas.length >= MAX_TREND_AREAS)) return;
            applyArea(key, { id: key, label: msa.name, color, msaGeoid: msa.geoid });
        }
    };

    const selectNeighborhood = (nh: NeighborhoodResult) => {
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
    };

    const selectMsa = (msa: { id: number; name: string; name_lsad: string; geoid: string }) => {
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
    };

    const addAreaByZip = (zip: string) => {
        if (selectedAreas.find((a) => a.id === zip)) {
            removeArea(zip);
            return;
        }
        if (selectedAreas.length >= MAX_TREND_AREAS) return;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas((prev) => [...prev, { id: zip, label: zip, color }]);
    };

    const addAreaByNeighborhood = (id: number, name: string, city: string) => {
        const key = `nh:${id}`;
        if (selectedAreas.find((a) => a.id === key)) {
            removeArea(key);
            return;
        }
        if (selectedAreas.length >= MAX_TREND_AREAS) return;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas((prev) => [...prev, { id: key, label: `${name} · ${city}`, color, neighborhoodId: id }]);
    };

    const addAreaByCounty = (name: string, state: string) => {
        const key = `county:${name}:${state}`;
        if (selectedAreas.find((a) => a.id === key)) {
            removeArea(key);
            return;
        }
        if (selectedAreas.length >= MAX_TREND_AREAS) return;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas((prev) => [...prev, { id: key, label: `${name}, ${state}`, color, countyName: name, countyState: state }]);
    };

    const addAreaByMsa = (geoid: string, name: string) => {
        const key = `msa:${geoid}`;
        if (selectedAreas.find((a) => a.id === key)) {
            removeArea(key);
            return;
        }
        if (selectedAreas.length >= MAX_TREND_AREAS) return;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas((prev) => [...prev, { id: key, label: name, color, msaGeoid: geoid }]);
    };

    const addAreaByCity = (name: string, state: string) => {
        const key = `city:${name}:${state}`;
        if (selectedAreas.find((a) => a.id === key)) {
            removeArea(key);
            return;
        }
        if (selectedAreas.length >= MAX_TREND_AREAS) return;
        const color = AREA_COLORS[selectedAreas.length % AREA_COLORS.length];
        setSelectedAreas((prev) => [...prev, { id: key, label: `${name}, ${state}`, color, cityName: name, cityState: state }]);
    };

    const removeArea = (id: string) => {
        setSelectedAreas((prev) => prev.filter((a) => a.id !== id));
        setAreaResults((prev) => {
            const next = { ...prev };
            delete next[id];
            delete next[`${id}:mid`];
            delete next[`${id}:reit`];
            return next;
        });
        setSalesResults((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const multiSource = selectedSegment === "both";
    const displayAreas = buildDisplayAreas(selectedAreas, selectedSegment);
    const { displayRentResults, displayActivityResults } = buildDisplayAreaResults(displayAreas, areaResults);

    const hasData = displayAreas.some((a) => (displayRentResults[a.id]?.length ?? 0) > 0);
    const hasActivity = displayAreas.some((a) => (displayActivityResults[a.id]?.length ?? 0) > 0);
    const hasSalesData = selectedAreas.some((a) => (salesResults[a.id]?.length ?? 0) > 0);

    const segmentToggle = (label: string, active: boolean, onClick: () => void) => (
        <button
            key={label}
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-all ${active ? "border-gray-300 bg-white text-gray-900 shadow-sm dark:border-gray-500 dark:bg-gray-600 dark:text-gray-100" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-700"}`}
        >
            <span
                className={`size-2 rounded-full border transition-all ${active ? "border-gray-500 bg-gray-500 dark:border-gray-300 dark:bg-gray-300" : "border-gray-300 dark:border-gray-500"}`}
            />
            {label}
        </button>
    );

    const searchPlaceholder = getTrendsSearchPlaceholder(areaType, addressMode);

    return (
        <div className="mx-auto w-full max-w-7xl flex-1 overflow-auto p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                {/* Rent / Sales data tab */}
                <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-700">
                    <button
                        type="button"
                        onClick={() => setDataTab("rent")}
                        className={`rounded-md px-4 py-1.5 font-medium whitespace-nowrap transition-colors ${dataTab === "rent" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                    >
                        Rent
                    </button>
                    <button
                        type="button"
                        onClick={() => setDataTab("sales")}
                        className={`rounded-md px-4 py-1.5 font-medium whitespace-nowrap transition-colors ${dataTab === "sales" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                    >
                        Sales
                    </button>
                </div>

                {/* Display mode — hide map for sales for now */}
                <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-700">
                    <button
                        type="button"
                        onClick={() => setDisplay("chart")}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium whitespace-nowrap transition-colors ${display === "chart" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                    >
                        <BarChart2 className="size-3.5" /> Chart
                    </button>
                    {dataTab === "rent" && (
                        <button
                            type="button"
                            onClick={() => setDisplay("table")}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium whitespace-nowrap transition-colors ${display === "table" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                        >
                            <Table2 className="size-3.5" /> Table
                        </button>
                    )}
                    {dataTab === "rent" && (
                        <button
                            type="button"
                            onClick={() => {
                                setDisplay("map");
                                if (!MAP_AREA_TYPES.has(areaType)) {
                                    setAreaType("ZIP Code");
                                    setSelectedAreas([]);
                                }
                                setAddress("");
                                setSuggestions([]);
                                setNhSuggestions([]);
                            }}
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium whitespace-nowrap transition-colors ${display === "map" ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                        >
                            <Map className="size-3.5" /> Map
                        </button>
                    )}
                </div>
            </div>

            {/* Filter panel */}
            <div className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                {/* Area type */}
                {(display === "chart" || display === "table" || display === "map") && (
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <span className="shrink-0 text-sm text-gray-500 sm:w-24 dark:text-gray-400">Area type</span>
                        <div className="flex min-w-0 flex-wrap items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-700">
                            {(display === "map" ? AREA_TYPES.filter((t) => MAP_AREA_TYPES.has(t)) : AREA_TYPES).map((t) => {
                                const enabled = display === "map" ? MAP_AREA_TYPES.has(t) : ENABLED_AREA_TYPES.has(t);
                                const active = !addressMode && areaType === t;
                                const dimmed = addressMode && !pendingFeature;
                                const resolvable = addressMode && !!pendingFeature;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        disabled={dimmed}
                                        onClick={() => {
                                            if (resolvable) {
                                                resolveGranularity(t);
                                            } else if (!addressMode && enabled) {
                                                if (lastAddressFeatureRef.current && t !== areaType) {
                                                    resolveGranularity(t, lastAddressFeatureRef.current);
                                                } else {
                                                    setAreaType(t);
                                                    setSelectedAreas([]);
                                                    setAddress("");
                                                    setSuggestions([]);
                                                    setNhSuggestions([]);
                                                    setPendingFeature(null);
                                                }
                                            }
                                        }}
                                        className={`rounded-md px-3 py-1 font-medium whitespace-nowrap transition-colors ${active ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100" : dimmed ? "cursor-not-allowed text-gray-300 dark:text-gray-600" : resolvable ? "text-gray-500 hover:text-gray-700 dark:text-gray-400" : enabled ? "text-gray-500 hover:text-gray-700 dark:text-gray-400" : "cursor-not-allowed text-gray-300 dark:text-gray-600"}`}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Area search */}
                <div className="flex items-start gap-4">
                    <span className="w-24 shrink-0 pt-2 text-sm text-gray-500 dark:text-gray-400">Area</span>
                    <div className="flex-1 space-y-2">
                        {selectedAreas.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedAreas.map((area) => (
                                    <span
                                        key={area.id}
                                        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                                        style={{ borderColor: area.color, color: area.color, backgroundColor: `${area.color}14` }}
                                    >
                                        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
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
                                        title="Add area to compare"
                                    >
                                        <span className="mb-px text-base leading-none">+</span>
                                    </button>
                                )}
                            </div>
                        )}
                        {pendingFeature && addressMode && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <MapPin className="size-3.5 shrink-0 text-gray-400" />
                                    <span className="flex-1 truncate">{pendingFeature.place_name}</span>
                                    <button type="button" onClick={cancelAddressMode} className="shrink-0 text-xs transition-opacity hover:opacity-60">
                                        ✕ change
                                    </button>
                                </div>
                                <div className="text-xs text-gray-400 dark:text-gray-500">Analyze as</div>
                                <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-700">
                                    {(["ZIP Code", "Neighborhood", "City", "County", "MSA"] as const).map((g) => {
                                        const ctx = pendingFeature.context ?? [];
                                        const regionShort = (
                                            (
                                                ctx.find((c) => c.id.startsWith("region.")) as
                                                    | ({ short_code?: string } & { id: string; text: string })
                                                    | undefined
                                            )?.short_code ?? ""
                                        ).replace("US-", "");
                                        const resolvedLabel =
                                            g === "ZIP Code"
                                                ? (ctx.find((c) => c.id.startsWith("postcode."))?.text ?? null)
                                                : g === "City"
                                                  ? ctx.find((c) => c.id.startsWith("place."))?.text
                                                      ? `${ctx.find((c) => c.id.startsWith("place."))!.text}${regionShort ? `, ${regionShort}` : ""}`
                                                      : null
                                                  : g === "County"
                                                    ? (ctx.find((c) => c.id.startsWith("district."))?.text ?? null)
                                                    : g === "Neighborhood"
                                                      ? pendingNh === "loading"
                                                          ? "…"
                                                          : pendingNh
                                                            ? `${pendingNh.name}`
                                                            : null
                                                      : /* MSA */ pendingMsa === "loading"
                                                        ? "…"
                                                        : pendingMsa
                                                          ? pendingMsa.name
                                                          : null;
                                        const disabled = resolvedLabel === null;
                                        return (
                                            <button
                                                key={g}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => resolveGranularity(g)}
                                                className={`flex-1 rounded-md px-2 py-1.5 text-center transition-colors ${disabled ? "cursor-not-allowed text-gray-300 dark:text-gray-600" : "text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-100"}`}
                                            >
                                                <div className="text-xs leading-tight font-medium">{resolvedLabel ?? "—"}</div>
                                                <div className="mt-0.5 text-xs leading-tight text-gray-400">{g}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {!pendingFeature && (selectedAreas.length === 0 || showAddInput || addressMode) && (
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1" ref={inputWrapperRef}>
                                    {addressMode ? (
                                        <MapPin className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-gray-400" />
                                    ) : (
                                        <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-gray-400" />
                                    )}
                                    <Input
                                        placeholder={searchPlaceholder}
                                        value={address}
                                        onChange={(e) => {
                                            setAddress(e.target.value);
                                            if (!addressMode) {
                                                lastAddressFeatureRef.current = null;
                                                lastAddressAreaIdRef.current = null;
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            const list =
                                                areaType === "Neighborhood" && !addressMode
                                                    ? nhSuggestions
                                                    : areaType === "MSA" && !addressMode
                                                      ? msaSuggestions
                                                      : suggestions;
                                            if (e.key === "ArrowDown") {
                                                e.preventDefault();
                                                setActiveSuggestionIndex((i) => Math.min(i + 1, list.length - 1));
                                            } else if (e.key === "ArrowUp") {
                                                e.preventDefault();
                                                setActiveSuggestionIndex((i) => Math.max(i - 1, 0));
                                            } else if (e.key === "Enter") {
                                                e.preventDefault();
                                                if (activeSuggestionIndex >= 0) {
                                                    if (areaType === "Neighborhood" && !addressMode) selectNeighborhood(nhSuggestions[activeSuggestionIndex]);
                                                    else if (areaType === "MSA" && !addressMode) selectMsa(msaSuggestions[activeSuggestionIndex]);
                                                    else selectSuggestion(suggestions[activeSuggestionIndex]);
                                                    setActiveSuggestionIndex(-1);
                                                }
                                            } else if (e.key === "Escape") {
                                                setShowSuggestions(false);
                                                setActiveSuggestionIndex(-1);
                                                if (addressMode) {
                                                    cancelAddressMode();
                                                } else if (selectedAreas.length > 0) {
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
                                        autoFocus={showAddInput || addressMode}
                                    />
                                    {showSuggestions && areaType === "Neighborhood" && !addressMode && nhSuggestions.length > 0 && (
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
                                    {showSuggestions && areaType === "MSA" && !addressMode && msaSuggestions.length > 0 && (
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
                                    {showSuggestions && (addressMode || (areaType !== "Neighborhood" && areaType !== "MSA")) && suggestions.length > 0 && (
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
                                {addressMode ? (
                                    <button
                                        type="button"
                                        onClick={cancelAddressMode}
                                        className="shrink-0 text-xs whitespace-nowrap text-gray-500 transition-colors hover:text-red-500"
                                    >
                                        ✕ cancel
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            prevAreaTypeRef.current = areaType;
                                            setAddressMode(true);
                                            setAddress("");
                                            setSuggestions([]);
                                        }}
                                        className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-gray-500 transition-colors hover:text-gray-700"
                                    >
                                        <MapPin className="size-3" /> by address
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Rent-only filters */}
                {dataTab === "rent" && (
                    <>
                        <div className="flex items-center gap-4">
                            <span className="w-24 shrink-0 text-sm text-gray-500 dark:text-gray-400">Bedrooms</span>
                            <div className="flex flex-wrap gap-2">
                                {BED_OPTIONS.map((opt) =>
                                    segmentToggle(opt.label, selectedBeds.includes(opt.beds), () =>
                                        setSelectedBeds((prev) => {
                                            if (prev.includes(opt.beds)) {
                                                if (prev.length === 1) return prev;
                                                return prev.filter((b) => b !== opt.beds);
                                            }
                                            return [...prev, opt.beds].sort((a, b) => a - b);
                                        }),
                                    ),
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="w-24 shrink-0 text-sm text-gray-500 dark:text-gray-400">Segment</span>
                            <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-700">
                                {(
                                    [
                                        { label: "All", value: "both" },
                                        { label: "Mid-market", value: "mid" },
                                        { label: "REIT", value: "reit" },
                                    ] as { label: string; value: "both" | "mid" | "reit" }[]
                                ).map(({ label, value }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setSelectedSegment(value)}
                                        className={`rounded-md px-3 py-1 font-medium whitespace-nowrap capitalize transition-colors ${selectedSegment === value ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ── Map display (rent only) ── */}
            {dataTab === "rent" && display === "map" && (
                <ZipTrendsMap
                    areaType={areaType as "ZIP Code" | "Neighborhood" | "City" | "County" | "MSA"}
                    selectedBeds={selectedBeds[0]}
                    reitsOnly={selectedSegment === "reit"}
                    selectedAreas={selectedAreas}
                    onAddZip={addAreaByZip}
                    onAddNeighborhood={addAreaByNeighborhood}
                    onAddCounty={addAreaByCounty}
                    onAddMsa={addAreaByMsa}
                    onAddCity={addAreaByCity}
                />
            )}

            {/* ── Empty state ── */}
            {(display === "chart" || display === "table" || dataTab === "sales") && selectedAreas.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center dark:border-gray-700 dark:bg-gray-800">
                    <TrendingUp className="mb-3 size-10 text-gray-300" />
                    <p className="text-gray-500 dark:text-gray-400">
                        {dataTab === "rent"
                            ? "Search an address, zip code, or neighborhood above to see rent trends"
                            : "Search an address, zip code, city, or area above to see sales trends"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Add up to {MAX_TREND_AREAS} areas to compare</p>
                </div>
            )}

            {/* ── Rent content ── */}
            {dataTab === "rent" && selectedAreas.length > 0 && (display === "chart" || display === "table") && (
                <>
                    {loading && (
                        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-16 dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-sm text-gray-400">Loading…</p>
                        </div>
                    )}

                    {!loading && !hasData && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center dark:border-gray-700 dark:bg-gray-800">
                            <TrendingUp className="mb-3 size-10 text-gray-300" />
                            <p className="text-gray-500 dark:text-gray-400">No data for the selected areas and bedroom type</p>
                        </div>
                    )}

                    {!loading && hasData && display === "chart" && (
                        <div className="grid grid-cols-4 gap-4">
                            {/* Stats tile */}
                            <div className="col-span-1 flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                                {displayAreas.map((area) => (
                                    <div key={area.id}>
                                        <div className="mb-2 flex items-center gap-1.5">
                                            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
                                            <span className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{area.label}</span>
                                        </div>
                                        <div className="space-y-2">
                                            {selectedBeds.map((beds) => {
                                                const bedEntry = BED_KEYS.find((b) => b.beds === beds)!;
                                                const rows = (displayRentResults[area.id] ?? [])
                                                    .filter((r) => r.beds === beds)
                                                    .sort((a, b) => a.week_start.localeCompare(b.week_start));
                                                const latest = rows.length > 0 ? rows[rows.length - 1].median_rent : undefined;
                                                const first = rows.length > 0 ? rows[0].median_rent : undefined;
                                                const change = rows.length >= 2 ? pctChange(first, latest) : null;
                                                return (
                                                    <div key={beds}>
                                                        {selectedBeds.length > 1 && (
                                                            <p className="mb-0.5 text-xs text-gray-400 dark:text-gray-500">{bedEntry.label}</p>
                                                        )}
                                                        {latest != null ? (
                                                            <>
                                                                <p className="text-lg font-semibold" style={{ color: area.color }}>
                                                                    {formatDollars(latest)}
                                                                </p>
                                                                {selectedBeds.length === 1 && (
                                                                    <p className="mt-0.5 text-xs text-gray-400">{bedEntry.label} · latest week</p>
                                                                )}
                                                                {change != null && (
                                                                    <div
                                                                        className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}
                                                                    >
                                                                        {change >= 0 ? (
                                                                            <ArrowUpRight className="size-3.5" />
                                                                        ) : (
                                                                            <ArrowDownRight className="size-3.5" />
                                                                        )}
                                                                        {Math.abs(change).toFixed(1)}% over period
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-lg font-semibold text-gray-400">—</p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Rent chart */}
                            <div className="col-span-3 row-span-2">
                                <RentTrendsSection areas={displayAreas} areaResults={displayRentResults} selectedBeds={selectedBeds} />
                            </div>

                            {/* Legend tile */}
                            <div className="col-span-1 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                                <div className="space-y-2">
                                    {displayAreas.map((area) => (
                                        <div key={area.id} className="flex items-center gap-1.5">
                                            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
                                            <span className="truncate text-xs text-gray-600 dark:text-gray-400">{area.label}</span>
                                        </div>
                                    ))}
                                </div>
                                {selectedBeds.length > 1 && (
                                    <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                                        {selectedBeds.map((beds) => {
                                            const bedEntry = BED_KEYS.find((b) => b.beds === beds)!;
                                            const dash = BED_DASH[beds] ?? "";
                                            return (
                                                <div key={beds} className="flex items-center gap-2">
                                                    <svg width="28" height="10" viewBox="0 0 28 10" className="shrink-0 text-gray-400 dark:text-gray-500">
                                                        <line
                                                            x1="0"
                                                            y1="5"
                                                            x2="28"
                                                            y2="5"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeDasharray={dash || undefined}
                                                        />
                                                    </svg>
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">{bedEntry.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {hasActivity && (
                                <div className="col-span-4 mb-8">
                                    <MarketActivitySection areas={displayAreas} areaResults={displayActivityResults} selectedBeds={selectedBeds} />
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && hasData && display === "table" && (
                        <TrendsTableSection
                            areas={displayAreas}
                            rentResults={displayRentResults}
                            activityResults={displayActivityResults}
                            selectedBeds={selectedBeds[0]}
                        />
                    )}
                </>
            )}

            {/* ── Sales content ── */}
            {dataTab === "sales" && selectedAreas.length > 0 && (
                <>
                    {salesLoading && (
                        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-16 dark:border-gray-700 dark:bg-gray-800">
                            <p className="text-sm text-gray-400">Loading…</p>
                        </div>
                    )}

                    {!salesLoading && !hasSalesData && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center dark:border-gray-700 dark:bg-gray-800">
                            <TrendingUp className="mb-3 size-10 text-gray-300" />
                            <p className="text-gray-500 dark:text-gray-400">No for-sale listings data for the selected area</p>
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Try a broader area type (City, County, or MSA)</p>
                        </div>
                    )}

                    {!salesLoading && hasSalesData && (
                        <div className="grid grid-cols-4 gap-4">
                            <SalesStatsTile areas={selectedAreas} areaResults={salesResults} />
                            <div className="col-span-3">
                                <SalesTrendsSection areas={selectedAreas} areaResults={salesResults} />
                            </div>
                            {/* Legend */}
                            <div className="col-span-1 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                                <div className="space-y-2">
                                    {selectedAreas.map((area) => (
                                        <div key={area.id} className="flex items-center gap-1.5">
                                            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
                                            <span className="truncate text-xs text-gray-600 dark:text-gray-400">{area.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
