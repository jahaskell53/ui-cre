"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/utils/supabase";
import { PaginationButtonGroup } from "@/components/application/pagination/pagination";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

function makeCircle(center: [number, number], radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
    const [lng, lat] = center;
    const dLat = radiusM / 111320;
    const dLng = dLat / Math.cos(lat * Math.PI / 180);
    const coords: [number, number][] = Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * 2 * Math.PI;
        return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
    });
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

function titleCaseAddress(s: string | null | undefined): string {
    if (s == null || s === '') return '';
    return s.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

interface CompResult {
    id: string;
    address_raw: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    area: number | null;
    distance_m: number;
    composite_score: number;
    img_src: string | null;
}

interface MapboxFeature {
    id: string;
    place_name: string;
    center: [number, number];
}

interface SearchParams {
    addr: string;
    coords: [number, number] | null;
    radius: number;
    price: string;
    beds: string;
    baths: string;
    area: string;
}

function CompsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // Read initial values from URL
    const initAddress = searchParams.get('address') ?? '';
    const initLat = searchParams.get('lat');
    const initLng = searchParams.get('lng');
    const initCoords: [number, number] | null =
        initLat && initLng ? [parseFloat(initLng), parseFloat(initLat)] : null;
    const initRadius = parseFloat(searchParams.get('radius') ?? '2');
    const initPrice = searchParams.get('price') ?? '';
    const initBeds = searchParams.get('beds') ?? '';
    const initBaths = searchParams.get('baths') ?? '';
    const initArea = searchParams.get('area') ?? '';

    const [address, setAddress] = useState(initAddress);
    const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(initCoords);
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [radiusMiles, setRadiusMiles] = useState(initRadius);
    const [subjectPrice, setSubjectPrice] = useState(initPrice);
    const [subjectBeds, setSubjectBeds] = useState(initBeds);
    const [subjectBaths, setSubjectBaths] = useState(initBaths);
    const [subjectArea, setSubjectArea] = useState(initArea);
    const [areaTolerance, setAreaTolerance] = useState(0.15);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [comps, setComps] = useState<CompResult[] | null>(null);
    const [compsPage, setCompsPage] = useState(1);
    const [sortCol, setSortCol] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [subjectLabel, setSubjectLabel] = useState<string | null>(initAddress || null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const miniMapContainerRef = useRef<HTMLDivElement>(null);
    const miniMapInstance = useRef<mapboxgl.Map | null>(null);
    const didAutoSearch = useRef(false);

    useEffect(() => {
        navigator.geolocation?.getCurrentPosition(
            ({ coords }) => setUserLocation([coords.longitude, coords.latitude]),
            () => {}
        );
    }, []);

    // Persist search params to URL without adding a history entry
    const pushToUrl = useCallback((p: SearchParams) => {
        const url = new URLSearchParams();
        if (p.addr) url.set('address', p.addr);
        if (p.coords) {
            url.set('lng', String(p.coords[0]));
            url.set('lat', String(p.coords[1]));
        }
        url.set('radius', String(p.radius));
        if (p.price) url.set('price', p.price);
        if (p.beds) url.set('beds', p.beds);
        if (p.baths) url.set('baths', p.baths);
        if (p.area) url.set('area', p.area);
        router.replace(`/analytics/comps?${url.toString()}`, { scroll: false });
    }, [router]);

    const runSearch = useCallback(async (p: SearchParams) => {
        if (!p.addr.trim()) return;
        setLoading(true);
        setError(null);
        setComps(null);
        try {
            let lng: number, lat: number;
            if (p.coords) {
                [lng, lat] = p.coords;
            } else {
                const geoRes = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(p.addr.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=1`
                );
                const geoData = await geoRes.json();
                if (!geoData.features?.length) {
                    setError("Address not found. Please try a different address.");
                    setLoading(false);
                    return;
                }
                [lng, lat] = geoData.features[0].center as [number, number];
                const label = geoData.features[0].place_name as string;
                setSubjectLabel(label);
                setSelectedCoords([lng, lat]);
            }

            const { data, error: rpcError } = await supabase.rpc('get_comps', {
                subject_lng: lng,
                subject_lat: lat,
                radius_m: p.radius * 1609.34,
                subject_price: p.price ? parseInt(p.price) : null,
                subject_beds: p.beds ? parseInt(p.beds) : null,
                subject_baths: p.baths ? parseFloat(p.baths) : null,
                subject_area: p.area ? parseInt(p.area) : null,
                area_tolerance: areaTolerance,
                p_limit: 500,
            });

            if (rpcError) {
                setError("Failed to find comps: " + rpcError.message);
            } else {
                const rows = (data ?? []) as Omit<CompResult, 'img_src'>[];
                const ids = rows.map(r => r.id);
                const { data: imgData } = await supabase
                    .from('cleaned_listings')
                    .select('id, img_src')
                    .in('id', ids);
                const imgMap = Object.fromEntries((imgData ?? []).map(r => [r.id, r.img_src as string | null]));
                const subjectStreet = p.addr.split(',')[0].trim().toLowerCase();
                const merged = rows
                    .map(r => ({ ...r, img_src: imgMap[r.id] ?? null }))
                    .filter(r => (r.address_street || r.address_raw || '').split(',')[0].trim().toLowerCase() !== subjectStreet);
                setComps(merged);
                setCompsPage(1);
            }
        } catch {
            setError("Something went wrong. Please try again.");
        }
        setLoading(false);
    }, [areaTolerance]);

    // Re-run search when area tolerance changes (if a search has already been run)
    useEffect(() => {
        if (!comps) return;
        findComps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [areaTolerance]);

    // Auto-run search on mount if URL has saved params
    useEffect(() => {
        if (didAutoSearch.current || !initAddress) return;
        didAutoSearch.current = true;
        runSearch({ addr: initAddress, coords: initCoords, radius: initRadius, price: initPrice, beds: initBeds, baths: initBaths, area: initArea });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const findComps = () => {
        const p: SearchParams = {
            addr: address,
            coords: selectedCoords,
            radius: radiusMiles,
            price: subjectPrice,
            beds: subjectBeds,
            baths: subjectBaths,
            area: subjectArea,
        };
        pushToUrl(p);
        runSearch(p);
    };

    const hasSubjectAttrs = subjectPrice || subjectBeds || subjectBaths || subjectArea;

    useEffect(() => {
        if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
        if (address.length < 3 || selectedCoords) {
            setSuggestions([]);
            return;
        }
        suggestTimerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&types=address,place&country=US${userLocation ? `&proximity=${userLocation[0]},${userLocation[1]}` : ''}`
                );
                const data = await res.json();
                setSuggestions((data.features ?? []) as MapboxFeature[]);
                setShowSuggestions(true);
            } catch {
                setSuggestions([]);
            }
        }, 250);
    }, [address, selectedCoords, userLocation]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        if (!selectedCoords) {
            miniMapInstance.current?.remove();
            miniMapInstance.current = null;
            return;
        }
        if (!miniMapContainerRef.current || miniMapInstance.current) return;

        const map = new mapboxgl.Map({
            container: miniMapContainerRef.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: selectedCoords,
            zoom: 11,
            accessToken: MAPBOX_TOKEN,
            interactive: false,
            attributionControl: false,
        });

        map.on('load', () => {
            new mapboxgl.Marker({ color: '#3b82f6' }).setLngLat(selectedCoords!).addTo(map);
            map.addSource('radius', { type: 'geojson', data: makeCircle(selectedCoords!, radiusMiles * 1609.34) });
            map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } });
            map.addLayer({ id: 'radius-outline', type: 'line', source: 'radius', paint: { 'line-color': '#3b82f6', 'line-width': 1.5, 'line-opacity': 0.6 } });
            const r = radiusMiles * 1609.34 / 111320;
            const lng = selectedCoords![0], lat = selectedCoords![1];
            map.fitBounds([[lng - r / Math.cos(lat * Math.PI / 180), lat - r], [lng + r / Math.cos(lat * Math.PI / 180), lat + r]], { padding: 24, duration: 0 });
        });

        miniMapInstance.current = map;
        return () => { miniMapInstance.current?.remove(); miniMapInstance.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCoords]);

    useEffect(() => {
        const map = miniMapInstance.current;
        if (!map || !selectedCoords) return;
        const update = () => {
            (map.getSource('radius') as mapboxgl.GeoJSONSource | undefined)?.setData(makeCircle(selectedCoords, radiusMiles * 1609.34));
            const r = radiusMiles * 1609.34 / 111320;
            const lng = selectedCoords[0], lat = selectedCoords[1];
            map.fitBounds([[lng - r / Math.cos(lat * Math.PI / 180), lat - r], [lng + r / Math.cos(lat * Math.PI / 180), lat + r]], { padding: 24 });
        };
        map.isStyleLoaded() ? update() : map.once('load', update);
    }, [radiusMiles, selectedCoords]);

    const selectSuggestion = (feature: MapboxFeature) => {
        setAddress(feature.place_name);
        setSelectedCoords(feature.center);
        setSubjectLabel(feature.place_name);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const marketStats = useMemo(() => {
        if (!comps || comps.length === 0) return null;
        const prices = comps.filter(c => c.price != null).map(c => c.price!).sort((a, b) => a - b);
        if (prices.length === 0) return null;
        const n = prices.length;
        const pct = (p: number) => {
            const idx = (p / 100) * (n - 1);
            const lo = Math.floor(idx), hi = Math.ceil(idx);
            return lo === hi ? prices[lo] : prices[lo] + (prices[hi] - prices[lo]) * (idx - lo);
        };
        const min = prices[0];
        const max = prices[n - 1];
        const p25 = pct(25);
        const median = pct(50);
        const p75 = pct(75);
        let subjectPercentile: number | null = null;
        if (subjectPrice) {
            const sp = parseInt(subjectPrice);
            if (!isNaN(sp)) {
                subjectPercentile = Math.round((prices.filter(p => p < sp).length / n) * 100);
            }
        }
        return { min, max, p25, median, p75, n, subjectPercentile };
    }, [comps, subjectPrice]);

    const rentEstimate = useMemo(() => {
        if (!comps || !subjectArea) return null;
        const area = parseInt(subjectArea);
        if (isNaN(area) || area <= 0) return null;
        const pts = comps.filter(c => c.price && c.area);
        if (pts.length === 0) return null;
        const rates = pts.map(c => c.price! / c.area!).sort((a, b) => a - b);
        const n = rates.length;
        const pct = (p: number) => {
            const idx = (p / 100) * (n - 1);
            const lo = Math.floor(idx), hi = Math.ceil(idx);
            return lo === hi ? rates[lo] : rates[lo] + (rates[hi] - rates[lo]) * (idx - lo);
        };
        const p25Rate = pct(25);
        const medianRate = pct(50);
        const p75Rate = pct(75);
        const round2sig = (v: number) => { const m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m; };
        return { low: round2sig(p25Rate * area), rent: round2sig(medianRate * area), high: round2sig(p75Rate * area), minRent: round2sig(rates[0] * area), maxRent: round2sig(rates[n - 1] * area), rate: medianRate, n };
    }, [comps, subjectArea]);

    const handleSort = (col: string) => {
        if (sortCol === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('asc');
        }
        setCompsPage(1);
    };

    const sortedComps = useMemo(() => {
        if (!comps) return [];
        if (!sortCol) return comps;
        const subPrice = subjectPrice ? parseInt(subjectPrice) : null;
        const subBeds = subjectBeds ? parseInt(subjectBeds) : null;
        const subBaths = subjectBaths ? parseFloat(subjectBaths) : null;
        const subAreaVal = subjectArea ? parseInt(subjectArea) : null;
        const subPpsf = subPrice && subAreaVal ? subPrice / subAreaVal : null;
        const getValue = (comp: CompResult): number => {
            switch (sortCol) {
                case 'price':    return subPrice    != null && comp.price != null ? Math.abs(comp.price - subPrice) : (comp.price ?? Infinity);
                case 'beds':     return subBeds     != null && comp.beds  != null ? Math.abs(comp.beds - subBeds)   : (comp.beds  ?? Infinity);
                case 'baths':    return subBaths    != null && comp.baths != null ? Math.abs(Number(comp.baths) - subBaths) : (Number(comp.baths) || Infinity);
                case 'area':     return subAreaVal  != null && comp.area  != null ? Math.abs(comp.area - subAreaVal)  : (comp.area  ?? Infinity);
                case 'ppsf': {
                    const compPpsf = comp.price && comp.area ? comp.price / comp.area : null;
                    return subPpsf != null && compPpsf != null ? Math.abs(compPpsf - subPpsf) : (compPpsf ?? Infinity);
                }
                case 'distance': return comp.distance_m;
                case 'score':    return comp.composite_score;
                default: return 0;
            }
        };
        const multiplier = sortDir === 'asc' ? 1 : -1;
        return [...comps].sort((a, b) => multiplier * (getValue(a) - getValue(b)));
    }, [comps, sortCol, sortDir, subjectPrice, subjectBeds, subjectBaths, subjectArea]);

    const metersToMiles = (m: number) => (m / 1609.34).toFixed(2);
    const scoreColor = (s: number) =>
        s >= 0.75 ? "text-green-600 dark:text-green-400" :
        s >= 0.55 ? "text-yellow-600 dark:text-yellow-400" :
        "text-red-500 dark:text-red-400";

    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Search form */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Find Comparable Rentals</h3>
                    <div className="space-y-4">
                        {/* Address */}
                        <div>
                            <Label className="text-xs mb-1.5 block">Subject Property Address</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1" ref={inputWrapperRef}>
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10 pointer-events-none" />
                                    <Input
                                        placeholder="e.g. 1228 El Camino Real, Palo Alto, CA"
                                        value={address}
                                        onChange={(e) => {
                                            setAddress(e.target.value);
                                            setSelectedCoords(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { setShowSuggestions(false); findComps(); }
                                            if (e.key === 'Escape') setShowSuggestions(false);
                                        }}
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
                                <Button onClick={findComps} disabled={loading || !address.trim()}>
                                    {loading ? 'Searching...' : 'Find Comps'}
                                </Button>
                            </div>
                        </div>

                        {/* Radius slider */}
                        <div>
                            <div className="flex justify-between mb-1.5">
                                <Label className="text-xs">Search Radius</Label>
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{radiusMiles} mi</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="10"
                                step="0.5"
                                value={radiusMiles}
                                onChange={(e) => setRadiusMiles(parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                <span>0.5 mi</span>
                                <span>10 mi</span>
                            </div>
                        </div>

                        {/* Radius preview map */}
                        <div
                            ref={miniMapContainerRef}
                            className={cn(
                                "rounded-lg overflow-hidden transition-all duration-300",
                                selectedCoords ? "h-44" : "h-0"
                            )}
                        />

                        {/* Optional subject attributes */}
                        <div>
                            <p className="text-xs text-gray-500 mb-2">
                                Optional: add subject attributes to score by similarity, not just distance
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <Label className="text-xs mb-1 block">Rent / mo</Label>
                                    <Input type="number" placeholder="e.g. 3500" value={subjectPrice}
                                        onChange={(e) => setSubjectPrice(e.target.value)} className="h-8 text-xs" />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1 block">Beds</Label>
                                    <Input type="number" placeholder="e.g. 3" value={subjectBeds}
                                        onChange={(e) => setSubjectBeds(e.target.value)} className="h-8 text-xs" />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1 block">Baths</Label>
                                    <Input type="number" step="0.5" placeholder="e.g. 2" value={subjectBaths}
                                        onChange={(e) => setSubjectBaths(e.target.value)} className="h-8 text-xs" />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1 block">Sq Ft</Label>
                                    <Input type="number" placeholder="e.g. 1200" value={subjectArea}
                                        onChange={(e) => setSubjectArea(e.target.value)} className="h-8 text-xs" />
                                    {subjectArea && (
                                        <div className="mt-1.5 flex items-center gap-1.5">
                                            <span className="text-[10px] text-gray-400">±</span>
                                            <select
                                                value={areaTolerance}
                                                onChange={(e) => setAreaTolerance(parseFloat(e.target.value))}
                                                className="text-[10px] text-gray-500 dark:text-gray-400 bg-transparent border-none outline-none cursor-pointer"
                                            >
                                                {[0.05, 0.10, 0.15, 0.20, 0.25, 0.30].map(v => (
                                                    <option key={v} value={v}>{Math.round(v * 100)}%</option>
                                                ))}
                                            </select>
                                            <span className="text-[10px] text-gray-400">size match</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <div className="size-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">Searching for comps...</p>
                    </div>
                )}

                {/* Rent estimate banner */}
                {!loading && comps !== null && comps.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                {rentEstimate && rentEstimate.n >= 8 ? 'Estimated Rent Range' : 'Estimated Rent'}
                            </p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-0.5">
                                {rentEstimate
                                    ? rentEstimate.n >= 8
                                        ? `$${rentEstimate.low.toLocaleString()} – $${rentEstimate.high.toLocaleString()}/mo`
                                        : rentEstimate.n >= 2
                                        ? `$${rentEstimate.minRent.toLocaleString()} – $${rentEstimate.maxRent.toLocaleString()}/mo`
                                        : `~$${rentEstimate.rent.toLocaleString()}/mo`
                                    : '—'}
                            </p>
                            {rentEstimate && rentEstimate.n >= 8 && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                    25th–75th percentile · median ${rentEstimate.rent.toLocaleString()}/mo
                                </p>
                            )}
                            {rentEstimate && rentEstimate.n >= 3 && rentEstimate.n < 8 && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                    min–max · median ${rentEstimate.rent.toLocaleString()}/mo
                                </p>
                            )}
                            {rentEstimate && rentEstimate.n < 3 && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                    {rentEstimate.n === 1 ? '1 comp — single data point' : 'min–max of 2 comps'}
                                </p>
                            )}
                            {!rentEstimate && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Enter sq ft above to estimate</p>
                            )}
                        </div>
                        {rentEstimate && (
                            <div className="text-right flex-shrink-0 space-y-0.5">
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    ±{Math.round(areaTolerance * 100)}% size match · {rentEstimate.n} comp{rentEstimate.n !== 1 ? 's' : ''}
                                </p>
                                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                                    ${rentEstimate.rate.toFixed(2)}<span className="text-xs font-normal ml-0.5">median $/sqft</span>
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Market distribution summary */}
                {!loading && marketStats && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Market Rent Distribution</h3>
                            <span className="text-xs text-gray-400">{marketStats.n} listing{marketStats.n !== 1 ? 's' : ''}</span>
                        </div>

                        {/* Small-n warning */}
                        {marketStats.n < 8 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                                Only {marketStats.n} comp{marketStats.n !== 1 ? 's' : ''} found — treat this range as approximate.
                            </div>
                        )}

                        {/* Stat row — gated by n */}
                        {marketStats.n < 3 ? (
                            <div className="grid grid-cols-2 gap-2 text-center">
                                {([
                                    { label: 'Min', value: marketStats.min },
                                    { label: 'Max', value: marketStats.max },
                                ]).map(({ label, value }) => (
                                    <div key={label} className="rounded-lg py-2 px-1 bg-gray-50 dark:bg-gray-700/40">
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
                                        <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">${Math.round(value).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        ) : marketStats.n < 8 ? (
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {([
                                    { label: 'Min',    value: marketStats.min },
                                    { label: 'Median', value: marketStats.median, highlight: true },
                                    { label: 'Max',    value: marketStats.max },
                                ]).map(({ label, value, highlight }) => (
                                    <div key={label} className={cn("rounded-lg py-2 px-1", highlight ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-700/40")}>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
                                        <p className={cn("text-sm font-semibold tabular-nums", highlight ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200")}>${Math.round(value).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-5 gap-2 text-center">
                                {([
                                    { label: 'Min',       value: marketStats.min },
                                    { label: '25th %ile', value: marketStats.p25 },
                                    { label: 'Median',    value: marketStats.median, highlight: true },
                                    { label: '75th %ile', value: marketStats.p75 },
                                    { label: 'Max',       value: marketStats.max },
                                ]).map(({ label, value, highlight }) => (
                                    <div key={label} className={cn("rounded-lg py-2 px-1", highlight ? "bg-blue-50 dark:bg-blue-900/20" : "bg-gray-50 dark:bg-gray-700/40")}>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
                                        <p className={cn("text-sm font-semibold tabular-nums", highlight ? "text-blue-700 dark:text-blue-300" : "text-gray-800 dark:text-gray-200")}>${Math.round(value).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Range bar — only when n >= 3 */}
                        {marketStats.n >= 3 && (() => {
                            const range = marketStats.max - marketStats.min || 1;
                            const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - marketStats.min) / range) * 100))}%`;
                            const subjectPx = subjectPrice ? parseInt(subjectPrice) : null;
                            return (
                                <div className="relative h-6 flex items-center">
                                    <div className="absolute inset-x-0 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                                    {marketStats.n >= 8 && (
                                        <div
                                            className="absolute h-1.5 bg-blue-300 dark:bg-blue-600 rounded-full"
                                            style={{ left: pos(marketStats.p25), right: `${100 - parseFloat(pos(marketStats.p75))}%` }}
                                        />
                                    )}
                                    <div
                                        className="absolute w-0.5 h-4 bg-blue-600 dark:bg-blue-400 rounded-full -translate-x-1/2"
                                        style={{ left: pos(marketStats.median) }}
                                    />
                                    {subjectPx != null && (
                                        <div
                                            className="absolute w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white dark:border-gray-800 shadow -translate-x-1/2"
                                            style={{ left: pos(subjectPx) }}
                                            title={`Your rent: $${subjectPx.toLocaleString()}`}
                                        />
                                    )}
                                </div>
                            );
                        })()}

                        {/* Legend — only when n >= 8 */}
                        {marketStats.n >= 8 && (
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-blue-300 dark:bg-blue-600 rounded-full inline-block" />Middle 50%</span>
                                <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-blue-600 dark:bg-blue-400 rounded-full inline-block" />Median</span>
                                {subjectPrice && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white dark:border-gray-800 inline-block" />Your rent</span>}
                            </div>
                        )}

                        {/* Percentile callout — only when n >= 8 */}
                        {marketStats.n >= 8 && marketStats.subjectPercentile !== null && (
                            <div className={cn(
                                "rounded-lg px-4 py-3 text-sm font-medium",
                                marketStats.subjectPercentile >= 50
                                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200"
                                    : "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                            )}>
                                Your rent of <span className="font-bold">${parseInt(subjectPrice).toLocaleString()}/mo</span> is higher than{' '}
                                <span className="font-bold">{marketStats.subjectPercentile}%</span> of similar listings
                                {marketStats.subjectPercentile >= 75 && ' — above the 75th percentile'}
                                {marketStats.subjectPercentile <= 25 && ' — below the 25th percentile'}
                                .
                            </div>
                        )}
                    </div>
                )}

                {/* Results table */}
                {!loading && comps !== null && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                    {comps.length} comp{comps.length !== 1 ? 's' : ''} found
                                </h3>
                                {subjectLabel && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">{subjectLabel}</p>
                                )}
                            </div>
                            <span className="text-xs text-gray-400 mt-1">
                                Ranked by {hasSubjectAttrs ? 'composite score' : 'distance'}
                            </span>
                        </div>

                        {comps.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No comps found within {radiusMiles} miles. Try a different address or expand the radius.
                            </div>
                        ) : (
                            <div className="overflow-x-auto" key={compsPage}>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                                            {(['price','beds','baths','area','ppsf','distance','score'] as const).map((col, idx) => {
                                                const labels: Record<string, string> = { price: 'Rent/mo', beds: 'Beds', baths: 'Baths', area: 'Sq Ft', ppsf: '$/Sq Ft', distance: 'Distance', score: 'Score' };
                                                const active = sortCol === col;
                                                return (
                                                    <th key={col} onClick={() => handleSort(col)}
                                                        className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors whitespace-nowrap", idx < 4 ? "text-right" : "text-right", active ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300")}
                                                    >
                                                        <span className="inline-flex items-center justify-end gap-1">
                                                            {labels[col]}
                                                            <span className="text-[10px]">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                                                        </span>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Subject property row */}
                                        <tr className="border-b-2 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
                                            <td className="px-4 py-3 text-xs font-semibold text-blue-600 dark:text-blue-400">You</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-blue-900 dark:text-blue-100 truncate max-w-[200px]">
                                                    {titleCaseAddress(subjectLabel?.split(',')[0]) || address || '—'}
                                                </div>
                                                <div className="text-xs text-blue-600/70 dark:text-blue-400/70 truncate max-w-[200px]">
                                                    {subjectLabel?.split(',').slice(1).join(',').trim() || ''}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-blue-900 dark:text-blue-100">
                                                {subjectPrice ? `$${parseInt(subjectPrice).toLocaleString()}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-800 dark:text-blue-200">{subjectBeds || '—'}</td>
                                            <td className="px-4 py-3 text-right text-blue-800 dark:text-blue-200">
                                                {subjectBaths ? Number(subjectBaths).toFixed(1) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-800 dark:text-blue-200">
                                                {subjectArea ? parseInt(subjectArea).toLocaleString() : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-800 dark:text-blue-200">
                                                {subjectPrice && subjectArea ? `$${(parseInt(subjectPrice) / parseInt(subjectArea)).toFixed(2)}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-blue-600/70 dark:text-blue-400/70 text-xs">0 mi</td>
                                            <td className="px-4 py-3 text-right text-blue-600/70 dark:text-blue-400/70 text-xs">—</td>
                                        </tr>
                                        {sortedComps.slice((compsPage - 1) * 25, compsPage * 25).map((comp, i) => (
                                            <tr key={comp.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="px-4 py-3 text-xs text-gray-400">{(compsPage - 1) * 25 + i + 1}</td>
                                                <td className="px-4 py-3">
                                                    <Link href={`/analytics/listing/zillow-${comp.id}`} className="group flex items-center gap-3">
                                                        <div className="w-16 h-12 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0 overflow-hidden">
                                                            {comp.img_src ? (
                                                                <img src={comp.img_src} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Building2 className="size-4 text-gray-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                {titleCaseAddress(comp.address_street || comp.address_raw) || '—'}
                                                            </div>
                                                            <div className="text-xs text-gray-500 truncate max-w-[160px]">
                                                                {[titleCaseAddress(comp.address_city), comp.address_state?.toUpperCase(), comp.address_zip].filter(Boolean).join(', ')}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                                                    {comp.price ? `$${comp.price.toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{comp.beds ?? '—'}</td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                    {comp.baths ? Number(comp.baths).toFixed(1) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                    {comp.area?.toLocaleString() ?? '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                    {comp.price && comp.area ? `$${(comp.price / comp.area).toFixed(2)}` : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                                    {metersToMiles(comp.distance_m)} mi
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className={cn("text-sm font-semibold tabular-nums", scoreColor(comp.composite_score))}>
                                                        {Math.round(comp.composite_score * 100)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {sortedComps.length > 25 && (
                            <PaginationButtonGroup
                                page={compsPage}
                                total={Math.ceil(sortedComps.length / 25)}
                                onPageChange={setCompsPage}
                                align="center"
                            />
                        )}
                    </div>
                )}

                {/* Empty state */}
                {!loading && comps === null && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                        <Search className="size-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Enter an address to find comparable rentals</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Searches within 2 miles using the latest scraped data</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CompsPage() {
    return (
        <Suspense>
            <CompsContent />
        </Suspense>
    );
}
