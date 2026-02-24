"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePageTour } from "@/hooks/use-page-tour";
import {
    Search,
    Filter,
    TrendingUp,
    Map,
    BarChart3,
    Calculator,
    Building2,
    ArrowUpRight,
    ArrowDownRight,
    Save,
    Layers,
    DollarSign,
    Home,
    Activity,
    ShoppingCart,
    MapPin,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PropertyMap, type Property, type HeatmapMetric, type MapBounds } from "@/components/application/map/property-map";
import { PaginationButtonGroup } from "@/components/application/pagination/pagination";
import { supabase } from "@/utils/supabase";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";
import { IrrProjectionChart } from "@/components/application/irr-projection-chart";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 200;

type ViewType = "trends" | "map" | "comps" | "valuation" | "properties";
type MapListingSource = "all" | "loopnet" | "zillow";

interface Filters {
    priceMin: string;
    priceMax: string;
    capRateMin: string;
    capRateMax: string;
    sqftMin: string;
    sqftMax: string;
}

const defaultFilters: Filters = {
    priceMin: "",
    priceMax: "",
    capRateMin: "",
    capRateMax: "",
    sqftMin: "",
    sqftMax: "",
};


// Mock user properties
const mockUserProperties = [
    { id: 1, address: "1228 El Camino", capRate: 5.2, image: null },
    { id: 2, address: "550 Blake", capRate: 3.47, image: null },
    { id: 3, address: "3541 Mission", capRate: 2.67, image: null },
];

// View Tab Button Component
function ViewTab({
    active,
    icon: Icon,
    label,
    onClick,
}: {
    active: boolean;
    icon: React.ElementType;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                active
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
        >
            <Icon className="size-4" />
            {label}
        </button>
    );
}

// ==================== TRENDS VIEW ====================
function TrendsView() {
    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cap Rate Trends */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Cap Rate Trends</h3>
                        <span className="text-xs text-gray-500">Last 12 months</span>
                    </div>
                    <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <BarChart3 className="size-12 text-blue-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">Chart visualization</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="flex items-center gap-1 text-green-600">
                            <ArrowUpRight className="size-4" />
                            <span className="text-sm font-medium">+0.3%</span>
                        </div>
                        <span className="text-sm text-gray-500">vs last quarter</span>
                    </div>
                </div>

                {/* Market Heatmap */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Market Heatmap</h3>
                        <select className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            <option>Bay Area</option>
                            <option>Los Angeles</option>
                            <option>San Diego</option>
                        </select>
                    </div>
                    <div className="h-48 bg-gradient-to-br from-green-100 via-yellow-100 to-red-100 dark:from-green-900/30 dark:via-yellow-900/30 dark:to-red-900/30 rounded-lg flex items-center justify-center relative overflow-hidden">
                        {/* Mock heatmap regions */}
                        <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-1 p-2">
                            {[...Array(12)].map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "rounded opacity-60",
                                        i % 3 === 0 ? "bg-green-400" : i % 3 === 1 ? "bg-yellow-400" : "bg-red-400"
                                    )}
                                />
                            ))}
                        </div>
                        <div className="relative z-10 bg-white/80 dark:bg-gray-900/80 px-3 py-1.5 rounded-lg">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Choropleth Map</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" /> Low</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded" /> Medium</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" /> High</span>
                    </div>
                </div>

                {/* Price per Sqft */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Price per Sq Ft</h3>
                        <span className="text-xs text-gray-500">By neighborhood</span>
                    </div>
                    <div className="space-y-3">
                        {[
                            { name: "Mission District", value: 1250, change: 5.2 },
                            { name: "SOMA", value: 1480, change: -2.1 },
                            { name: "Nob Hill", value: 1820, change: 3.8 },
                            { name: "Castro", value: 1340, change: 1.5 },
                        ].map((item) => (
                            <div key={item.name} className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        ${item.value.toLocaleString()}
                                    </span>
                                    <span className={cn(
                                        "text-xs flex items-center gap-0.5",
                                        item.change > 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                        {item.change > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                        {Math.abs(item.change)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rent Trends */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Avg Rent Trends</h3>
                        <span className="text-xs text-gray-500">Monthly</span>
                    </div>
                    <div className="h-32 flex items-end justify-between gap-2 px-2">
                        {[65, 70, 68, 75, 82, 78, 85, 88, 92, 90, 95, 98].map((h, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t"
                                style={{ height: `${h}%` }}
                            />
                        ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                        <span>Jan</span>
                        <span>Jun</span>
                        <span>Dec</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Heatmap layer options
const heatmapOptions: { value: HeatmapMetric; label: string; icon: React.ElementType; description?: string }[] = [
    { value: 'none', label: 'None', icon: Layers, description: 'Show markers only' },
    { value: 'neighborhood', label: 'Neighborhoods', icon: Map, description: 'Filter by area' },
    { value: 'capRate', label: 'Cap Rate', icon: TrendingUp, description: 'Heatmap by cap rate' },
    { value: 'rent', label: 'Avg Rent', icon: Home, description: 'Heatmap by rent levels' },
    { value: 'valuation', label: 'Valuation', icon: DollarSign, description: 'Heatmap by property value' },
    { value: 'recentSales', label: 'Recent Sales', icon: ShoppingCart, description: 'Heatmap by sales activity' },
    { value: 'trending', label: 'Trending', icon: Activity, description: 'Heatmap by appreciation' },
];

// ==================== MAP VIEW ====================
function MapView({
    properties,
    selectedId,
    setSelectedId,
    loading,
    page,
    totalCount,
    totalPages,
    handlePageChange,
    searchQuery,
    setSearchQuery,
    setPage,
    filters,
    setFilters,
    filtersOpen,
    setFiltersOpen,
    activeFilterCount,
    clearFilters,
    mapListingSource,
    setMapListingSource,
    setMapBounds,
}: {
    properties: Property[];
    selectedId: string | number | null;
    setSelectedId: (id: string | number | null) => void;
    loading: boolean;
    page: number;
    totalCount: number;
    totalPages: number;
    handlePageChange: (page: number) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    setPage: (page: number) => void;
    filters: Filters;
    setFilters: React.Dispatch<React.SetStateAction<Filters>>;
    filtersOpen: boolean;
    setFiltersOpen: (open: boolean) => void;
    activeFilterCount: number;
    clearFilters: () => void;
    mapListingSource: MapListingSource;
    setMapListingSource: (s: MapListingSource) => void;
    setMapBounds: (bounds: MapBounds) => void;
}) {
    const [mapFilter, setMapFilter] = useState<"all" | "owned">("all");
    const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('none');
    const [layersOpen, setLayersOpen] = useState(false);
    const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleBoundsChange = useCallback((bounds: MapBounds) => {
        if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
        boundsTimerRef.current = setTimeout(() => {
            setPage(0);
            setMapBounds(bounds);
        }, 300);
    }, [setMapBounds, setPage]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Map Controls Bar */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4 flex-shrink-0 bg-white dark:bg-gray-900 flex-wrap">
                {/* Sales vs Rent toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {(["loopnet", "zillow", "all"] as const).map((source) => (
                        <button
                            key={source}
                            onClick={() => { setMapListingSource(source); setPage(0); }}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                                mapListingSource === source
                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400"
                            )}
                        >
                            {source === "all" ? "All" : source === "loopnet" ? "Sales" : "Rent"}
                        </button>
                    ))}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    {(["all", "owned"] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setMapFilter(filter)}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                                mapFilter === filter
                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-600 dark:text-gray-400"
                            )}
                        >
                            {filter === "all" ? "All" : filter}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                        placeholder="Search city, neighborhood..."
                        className="pl-9 h-8 text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(0);
                        }}
                    />
                </div>

                {/* Filters Popover */}
                <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 relative">
                            <Filter className="size-3.5" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 size-4 rounded-full bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-sm">Filters</h3>
                                {activeFilterCount > 0 && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto px-2 py-1 text-xs">
                                        Clear all
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-xs">Price Range</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            type="number"
                                            placeholder="Min"
                                            value={filters.priceMin}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, priceMin: e.target.value })); setPage(0); }}
                                            className="h-7 text-xs"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Max"
                                            value={filters.priceMax}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, priceMax: e.target.value })); setPage(0); }}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">Cap Rate (%)</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            type="number"
                                            placeholder="Min"
                                            value={filters.capRateMin}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, capRateMin: e.target.value })); setPage(0); }}
                                            className="h-7 text-xs"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Max"
                                            value={filters.capRateMax}
                                            onChange={(e) => { setFilters(prev => ({ ...prev, capRateMax: e.target.value })); setPage(0); }}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Heatmap Layers Popover */}
                <Popover open={layersOpen} onOpenChange={setLayersOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={heatmapMetric !== 'none' ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                                "h-8 gap-1.5",
                                heatmapMetric !== 'none' && "bg-blue-600 hover:bg-blue-700"
                            )}
                        >
                            <Layers className="size-3.5" />
                            Layers
                            {heatmapMetric !== 'none' && (
                                <span className="text-[10px] opacity-80">
                                    ({heatmapOptions.find(o => o.value === heatmapMetric)?.label})
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-2">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 px-2 py-1">Map Layers</p>
                            {heatmapOptions.map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            setHeatmapMetric(option.value);
                                            setLayersOpen(false);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors text-left",
                                            heatmapMetric === option.value
                                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                        )}
                                    >
                                        <Icon className="size-4 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium">{option.label}</div>
                                            {option.description && (
                                                <div className="text-[10px] text-gray-500 dark:text-gray-400">{option.description}</div>
                                            )}
                                        </div>
                                        {heatmapMetric === option.value && (
                                            <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">✓</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Map Content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                {/* Sidebar */}
                <div className="w-full lg:w-72 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 z-10">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {loading ? 'Loading...' : `${totalCount.toLocaleString()} Results`}
                        </span>
                    </div>

                    <div className="flex-1 overflow-auto divide-y divide-gray-200 dark:divide-gray-800">
                        {loading ? (
                            <PropertiesListSkeleton count={4} />
                        ) : properties.length === 0 ? (
                            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                                No properties found
                            </div>
                        ) : (
                            properties.slice(0, 20).map((property) => (
                                <div
                                    key={property.id}
                                    onClick={() => setSelectedId(property.id)}
                                    className={cn(
                                        "p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors",
                                        selectedId === property.id && "bg-gray-50 dark:bg-gray-800"
                                    )}
                                >
                                    <Link href={`/analytics/listing/${property.id}`} className="flex gap-3 group" onClick={(e) => e.stopPropagation()}>
                                        <div className="w-16 h-12 bg-gray-100 dark:bg-gray-800 rounded flex-shrink-0 overflow-hidden">
                                            {property.thumbnailUrl ? (
                                                <img src={property.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Building2 className="size-4 text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {property.name}
                                            </h4>
                                            <p className="text-[10px] text-gray-500 truncate">{property.address}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                                    {property.price}
                                                </span>
                                                {property.capRate && (
                                                    <span className="text-[10px] text-gray-500">{property.capRate}</span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>

                    {!loading && totalPages > 1 && (
                        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                            <PaginationButtonGroup
                                page={page + 1}
                                total={totalPages}
                                onPageChange={handlePageChange}
                                align="center"
                            />
                        </div>
                    )}
                </div>

                {/* Map */}
                <div className="flex-1 relative">
                    <PropertyMap
                        properties={properties}
                        selectedId={selectedId}
                        heatmapMetric={heatmapMetric}
                        className="absolute inset-0"
                        onBoundsChange={handleBoundsChange}
                    />
                </div>
            </div>
        </div>
    );
}

// ==================== COMPS VIEW ====================
const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

function titleCaseAddress(s: string | null | undefined): string {
    if (s == null || s === '') return '';
    return s
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
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
}

interface MapboxFeature {
    id: string;
    place_name: string;
    center: [number, number];
}

function CompsView() {
    const [address, setAddress] = useState("");
    const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
    const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [subjectPrice, setSubjectPrice] = useState("");
    const [subjectBeds, setSubjectBeds] = useState("");
    const [subjectBaths, setSubjectBaths] = useState("");
    const [subjectArea, setSubjectArea] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [comps, setComps] = useState<CompResult[] | null>(null);
    const [subjectLabel, setSubjectLabel] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);

    // Request geolocation once on mount to bias autocomplete results
    useEffect(() => {
        navigator.geolocation?.getCurrentPosition(
            ({ coords }) => setUserLocation([coords.longitude, coords.latitude]),
            () => {} // silently ignore denial
        );
    }, []);

    const hasSubjectAttrs = subjectPrice || subjectBeds || subjectBaths || subjectArea;

    // Fetch suggestions as the user types (debounced 250ms, min 3 chars)
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

    // Close suggestions when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selectSuggestion = (feature: MapboxFeature) => {
        setAddress(feature.place_name);
        setSelectedCoords(feature.center);
        setSubjectLabel(feature.place_name);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const findComps = async () => {
        if (!address.trim()) return;
        setLoading(true);
        setError(null);
        setComps(null);
        try {
            let lng: number, lat: number;
            if (selectedCoords) {
                [lng, lat] = selectedCoords;
            } else {
                const geoRes = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=1`
                );
                const geoData = await geoRes.json();
                if (!geoData.features?.length) {
                    setError("Address not found. Please try a different address.");
                    setLoading(false);
                    return;
                }
                [lng, lat] = geoData.features[0].center as [number, number];
                setSubjectLabel(geoData.features[0].place_name as string);
            }

            const { data, error: rpcError } = await supabase.rpc('get_comps', {
                subject_lng: lng,
                subject_lat: lat,
                radius_m: 3218,
                subject_price: subjectPrice ? parseInt(subjectPrice) : null,
                subject_beds: subjectBeds ? parseInt(subjectBeds) : null,
                subject_baths: subjectBaths ? parseFloat(subjectBaths) : null,
                subject_area: subjectArea ? parseInt(subjectArea) : null,
                p_limit: 10,
            });

            if (rpcError) {
                setError("Failed to find comps: " + rpcError.message);
            } else {
                setComps((data ?? []) as CompResult[]);
            }
        } catch {
            setError("Something went wrong. Please try again.");
        }
        setLoading(false);
    };

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
                                            setSelectedCoords(null); // reset coords when user edits
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { setShowSuggestions(false); findComps(); }
                                            if (e.key === 'Escape') setShowSuggestions(false);
                                        }}
                                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                        className="pl-9"
                                        autoComplete="off"
                                    />
                                    {/* Suggestions dropdown */}
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

                {/* Results */}
                {comps !== null && (
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
                                No comps found within 2 miles. Try a different address or expand the radius.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rent/mo</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Beds</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Baths</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sq Ft</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Distance</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comps.map((comp, i) => (
                                            <tr key={comp.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                                                <td className="px-4 py-3">
                                                    <Link href={`/analytics/listing/zillow-${comp.id}`} className="group">
                                                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                            {titleCaseAddress(comp.address_street || comp.address_raw) || '—'}
                                                        </div>
                                                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                                            {[titleCaseAddress(comp.address_city), comp.address_state?.toUpperCase(), comp.address_zip].filter(Boolean).join(', ')}
                                                        </div>
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                                                    {comp.price ? `$${comp.price.toLocaleString()}` : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                    {comp.beds ?? '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                    {comp.baths ? Number(comp.baths).toFixed(1) : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                                                    {comp.area?.toLocaleString() ?? '—'}
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
                    </div>
                )}

                {/* Empty state */}
                {comps === null && !loading && (
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

// ==================== VALUATION VIEW ====================
function ValuationView() {
    const [capRate, setCapRate] = useState(4.5);
    const [rent, setRent] = useState(3000);
    const [vacancy, setVacancy] = useState(5);

    // Mock calculations
    const annualRent = rent * 12 * 11 * (1 - vacancy / 100); // 11 units
    const estimatedValue = Math.round(annualRent / (capRate / 100));
    const irr = 12.1; // Mock IRR

    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Property Selection */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Property</h3>
                        <div className="flex gap-4">
                            <div className="w-24 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <Building2 className="size-8 text-gray-400" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">1228 El Camino</h4>
                                <p className="text-sm text-gray-500 mt-1">Palo Alto, CA</p>
                                <p className="text-xs text-gray-400 mt-2">11 Units • 8,500 sq ft</p>
                            </div>
                        </div>
                    </div>

                    {/* Valuation Result */}
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-blue-100">Estimated Valuation</h3>
                            <Button size="sm" variant="secondary" className="h-7 text-xs gap-1">
                                <Save className="size-3" />
                                Save
                            </Button>
                        </div>
                        <p className="text-4xl font-bold">${estimatedValue.toLocaleString()}</p>
                        <div className="mt-4 flex items-center gap-4 text-sm">
                            <div>
                                <span className="text-blue-200">IRR</span>
                                <span className="ml-2 font-semibold">{irr}%</span>
                            </div>
                            <div>
                                <span className="text-blue-200">NOI</span>
                                <span className="ml-2 font-semibold">${Math.round(annualRent).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sliders */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-6">Adjust Parameters</h3>

                    <div className="space-y-8">
                        {/* Cap Rate Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">Cap Rate</Label>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{capRate}%</span>
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
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>1%</span>
                                <span>10%</span>
                            </div>
                        </div>

                        {/* Rent Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">Avg Monthly Rent</Label>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    ${rent.toLocaleString()}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="1000"
                                max="8000"
                                step="100"
                                value={rent}
                                onChange={(e) => setRent(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>$1,000</span>
                                <span>$8,000</span>
                            </div>
                        </div>

                        {/* Vacancy Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">Vacancy Rate</Label>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{vacancy}%</span>
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
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>0%</span>
                                <span>20%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* IRR projection */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <IrrProjectionChart currentIrr={irr} years={5} height={180} />
                </div>
            </div>
        </div>
    );
}

// ==================== YOUR PROPERTIES VIEW ====================
function YourPropertiesView() {
    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Properties</h2>
                <Button size="sm" className="gap-1">
                    <Building2 className="size-4" />
                    Add Property
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {mockUserProperties.map((property) => (
                    <Link
                        key={property.id}
                        href={`/analytics/your-properties/${property.id}`}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group block"
                    >
                        <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-700 relative">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Building2 className="size-12 text-gray-300 dark:text-gray-600" />
                            </div>
                            {/* Cap Rate Badge */}
                            <div className="absolute top-3 right-3 bg-white dark:bg-gray-800 px-2 py-1 rounded-md shadow-sm">
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {property.capRate}%
                                </span>
                            </div>
                        </div>
                        <div className="p-4">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {property.address}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Cap Rate</p>
                        </div>
                    </Link>
                ))}

                {/* Add Property Card */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer flex items-center justify-center min-h-[200px]">
                    <div className="text-center">
                        <div className="size-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                            <Building2 className="size-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Add Property</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Skeleton Component
function PropertiesListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-3">
                    <div className="flex gap-3">
                        <div className="w-16 h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="flex-1">
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2 mt-2" />
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3 mt-2" />
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
}

// ==================== MAIN PAGE ====================
export default function AnalyticsPage() {
    const [activeView, setActiveView] = useState<ViewType>("map");
    const [properties, setProperties] = useState<Property[]>([]);
    const [selectedId, setSelectedId] = useState<string | number | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState<Filters>(defaultFilters);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [mapListingSource, setMapListingSource] = useState<MapListingSource>("all");

    usePageTour(() => setIsTourOpen(true));

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.priceMin || filters.priceMax) count++;
        if (filters.capRateMin || filters.capRateMax) count++;
        if (filters.sqftMin || filters.sqftMax) count++;
        return count;
    }, [filters]);

    const clearFilters = () => {
        setFilters(defaultFilters);
        setPage(0);
    };

    const fetchProperties = useCallback(async (pageNum: number, search: string, currentFilters: Filters, source: MapListingSource, bounds: MapBounds | null) => {
        setLoading(true);

        type RowWithDate = Property & { _createdAt?: string };
        const mapLoopnet = (item: Record<string, unknown>): RowWithDate => ({
            id: item.id as string | number,
            name: (item.headline || item.address || 'Building') as string,
            address: (item.address || 'Address not listed') as string,
            location: (item.location as string) ?? undefined,
            units: item.square_footage ? (Math.floor(parseInt(String(item.square_footage).replace(/[^0-9]/g, '') || '0') / 500) || null) : null,
            price: (item.price as string) || 'TBD',
            coordinates: [item.longitude as number, item.latitude as number],
            thumbnailUrl: (item.thumbnail_url as string | null) ?? undefined,
            capRate: (item.cap_rate as string | null) ?? undefined,
            squareFootage: (item.square_footage as string) ?? undefined,
            listingSource: 'loopnet',
            _createdAt: (item.created_at as string) ?? '',
        });

        const mapCleanedListing = (item: Record<string, unknown>): RowWithDate => {
            const city = (item.address_city as string) || '';
            const fullAddress = (item.address_raw as string) ||
                [item.address_street, city, item.address_state, item.address_zip].filter(Boolean).join(', ') ||
                'Address not listed';
            const priceVal = item.price as number | null;
            return {
                id: `zillow-${item.id as string}`,
                name: fullAddress,
                address: fullAddress,
                location: city || undefined,
                units: null,
                price: priceVal ? `$${priceVal.toLocaleString()}` : 'TBD',
                coordinates: [item.longitude as number, item.latitude as number],
                thumbnailUrl: undefined,
                capRate: undefined,
                squareFootage: item.area ? String(item.area) : undefined,
                listingSource: 'zillow',
                _createdAt: (item.scraped_at as string) ?? '',
            };
        };

        if (source === 'loopnet') {
            let loopnetQuery = supabase
                .from('loopnet_listings')
                .select('*', { count: 'exact' })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .order('created_at', { ascending: false });
            if (search) {
                loopnetQuery = loopnetQuery.or(`headline.ilike.%${search}%,address.ilike.%${search}%,location.ilike.%${search}%`);
            }
            if (currentFilters.priceMin) {
                const minPrice = parseFloat(currentFilters.priceMin);
                if (!isNaN(minPrice)) loopnetQuery = loopnetQuery.gte('numeric_price', minPrice);
            }
            if (currentFilters.priceMax) {
                const maxPrice = parseFloat(currentFilters.priceMax);
                if (!isNaN(maxPrice)) loopnetQuery = loopnetQuery.lte('numeric_price', maxPrice);
            }
            if (currentFilters.capRateMin) {
                const minCapRate = parseFloat(currentFilters.capRateMin);
                if (!isNaN(minCapRate)) loopnetQuery = loopnetQuery.gte('numeric_cap_rate', minCapRate);
            }
            if (currentFilters.capRateMax) {
                const maxCapRate = parseFloat(currentFilters.capRateMax);
                if (!isNaN(maxCapRate)) loopnetQuery = loopnetQuery.lte('numeric_cap_rate', maxCapRate);
            }
            if (currentFilters.sqftMin) {
                const minSqft = parseFloat(currentFilters.sqftMin);
                if (!isNaN(minSqft)) loopnetQuery = loopnetQuery.gte('numeric_square_footage', minSqft);
            }
            if (currentFilters.sqftMax) {
                const maxSqft = parseFloat(currentFilters.sqftMax);
                if (!isNaN(maxSqft)) loopnetQuery = loopnetQuery.lte('numeric_square_footage', maxSqft);
            }
            if (bounds) {
                loopnetQuery = loopnetQuery
                    .gte('latitude', bounds.south).lte('latitude', bounds.north)
                    .gte('longitude', bounds.west).lte('longitude', bounds.east);
            }
            const { data, error, count } = await loopnetQuery.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
            if (error) console.error('Error fetching loopnet listings:', error);
            const rows = (data ?? []).map((item) => mapLoopnet(item as Record<string, unknown>));
            setProperties(rows.map(({ _createdAt: _, ...p }) => p));
            setTotalCount(count ?? 0);
            setLoading(false);
            return;
        }

        if (source === 'zillow') {
            let zillowQuery = supabase
                .from('cleaned_listings')
                .select('*', { count: 'exact' })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .order('scraped_at', { ascending: false });
            if (search) {
                zillowQuery = zillowQuery.or(`address_raw.ilike.%${search}%,address_street.ilike.%${search}%,address_city.ilike.%${search}%`);
            }
            if (currentFilters.priceMin) {
                const minPrice = parseFloat(currentFilters.priceMin);
                if (!isNaN(minPrice)) zillowQuery = zillowQuery.gte('price', minPrice);
            }
            if (currentFilters.priceMax) {
                const maxPrice = parseFloat(currentFilters.priceMax);
                if (!isNaN(maxPrice)) zillowQuery = zillowQuery.lte('price', maxPrice);
            }
            if (currentFilters.sqftMin) {
                const minSqft = parseFloat(currentFilters.sqftMin);
                if (!isNaN(minSqft)) zillowQuery = zillowQuery.gte('area', minSqft);
            }
            if (currentFilters.sqftMax) {
                const maxSqft = parseFloat(currentFilters.sqftMax);
                if (!isNaN(maxSqft)) zillowQuery = zillowQuery.lte('area', maxSqft);
            }
            if (bounds) {
                zillowQuery = zillowQuery
                    .gte('latitude', bounds.south).lte('latitude', bounds.north)
                    .gte('longitude', bounds.west).lte('longitude', bounds.east);
            }
            const { data, error, count } = await zillowQuery.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
            if (error) console.error('Error fetching cleaned listings:', error);
            const rows = (data ?? []).map((item) => mapCleanedListing(item as Record<string, unknown>));
            setProperties(rows.map(({ _createdAt: _, ...p }) => p));
            setTotalCount(count ?? 0);
            setLoading(false);
            return;
        }

        if (source === 'all') {
            let loopnetQuery = supabase
                .from('loopnet_listings')
                .select('*', { count: 'exact' })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .order('created_at', { ascending: false });
            if (search) {
                loopnetQuery = loopnetQuery.or(`headline.ilike.%${search}%,address.ilike.%${search}%,location.ilike.%${search}%`);
            }
            if (currentFilters.priceMin) {
                const minPrice = parseFloat(currentFilters.priceMin);
                if (!isNaN(minPrice)) loopnetQuery = loopnetQuery.gte('numeric_price', minPrice);
            }
            if (currentFilters.priceMax) {
                const maxPrice = parseFloat(currentFilters.priceMax);
                if (!isNaN(maxPrice)) loopnetQuery = loopnetQuery.lte('numeric_price', maxPrice);
            }
            if (currentFilters.capRateMin) {
                const minCapRate = parseFloat(currentFilters.capRateMin);
                if (!isNaN(minCapRate)) loopnetQuery = loopnetQuery.gte('numeric_cap_rate', minCapRate);
            }
            if (currentFilters.capRateMax) {
                const maxCapRate = parseFloat(currentFilters.capRateMax);
                if (!isNaN(maxCapRate)) loopnetQuery = loopnetQuery.lte('numeric_cap_rate', maxCapRate);
            }
            if (currentFilters.sqftMin) {
                const minSqft = parseFloat(currentFilters.sqftMin);
                if (!isNaN(minSqft)) loopnetQuery = loopnetQuery.gte('numeric_square_footage', minSqft);
            }
            if (currentFilters.sqftMax) {
                const maxSqft = parseFloat(currentFilters.sqftMax);
                if (!isNaN(maxSqft)) loopnetQuery = loopnetQuery.lte('numeric_square_footage', maxSqft);
            }
            if (bounds) {
                loopnetQuery = loopnetQuery
                    .gte('latitude', bounds.south).lte('latitude', bounds.north)
                    .gte('longitude', bounds.west).lte('longitude', bounds.east);
            }

            let zillowQuery = supabase
                .from('cleaned_listings')
                .select('*', { count: 'exact' })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .order('scraped_at', { ascending: false });
            if (search) {
                zillowQuery = zillowQuery.or(`address_raw.ilike.%${search}%,address_street.ilike.%${search}%,address_city.ilike.%${search}%`);
            }
            if (currentFilters.priceMin) {
                const minPrice = parseFloat(currentFilters.priceMin);
                if (!isNaN(minPrice)) zillowQuery = zillowQuery.gte('price', minPrice);
            }
            if (currentFilters.priceMax) {
                const maxPrice = parseFloat(currentFilters.priceMax);
                if (!isNaN(maxPrice)) zillowQuery = zillowQuery.lte('price', maxPrice);
            }
            if (currentFilters.sqftMin) {
                const minSqft = parseFloat(currentFilters.sqftMin);
                if (!isNaN(minSqft)) zillowQuery = zillowQuery.gte('area', minSqft);
            }
            if (currentFilters.sqftMax) {
                const maxSqft = parseFloat(currentFilters.sqftMax);
                if (!isNaN(maxSqft)) zillowQuery = zillowQuery.lte('area', maxSqft);
            }
            if (bounds) {
                zillowQuery = zillowQuery
                    .gte('latitude', bounds.south).lte('latitude', bounds.north)
                    .gte('longitude', bounds.west).lte('longitude', bounds.east);
            }

            const [loopnetRes, zillowRes] = await Promise.all([
                loopnetQuery.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1),
                zillowQuery.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1),
            ]);

            if (loopnetRes.error) console.error('Error fetching loopnet listings:', loopnetRes.error);
            if (zillowRes.error) console.error('Error fetching cleaned listings:', zillowRes.error);

            const loopnetRows = (loopnetRes.data ?? []).map((item) => mapLoopnet(item as Record<string, unknown>))
                .sort((a, b) => (b._createdAt || '').localeCompare(a._createdAt || ''));
            const zillowRows = (zillowRes.data ?? []).map((item) => mapCleanedListing(item as Record<string, unknown>))
                .sort((a, b) => (b._createdAt || '').localeCompare(a._createdAt || ''));
            const merged = [...loopnetRows, ...zillowRows].sort((a, b) => (b._createdAt || '').localeCompare(a._createdAt || ''));
            setProperties(merged.map(({ _createdAt: _, ...p }) => p));
            setTotalCount((loopnetRes.count ?? 0) + (zillowRes.count ?? 0));
        }

        setLoading(false);
    }, []);

    const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

    useEffect(() => {
        if (!mapBounds) return;
        const timer = setTimeout(() => {
            fetchProperties(page, searchQuery, filters, mapListingSource, mapBounds);
        }, searchQuery ? 500 : 0);

        return () => clearTimeout(timer);
    }, [page, searchQuery, filters, mapListingSource, mapBounds, fetchProperties]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const handlePageChange = (newPage: number) => {
        setPage(newPage - 1);
    };

    const tourSteps: TourStep[] = [
        {
            id: "view-tabs",
            target: '[data-tour="view-tabs"]',
            title: "Analytics Views",
            content: "Switch between different views: Trends for analytics, Map for property locations, Comps for comparisons, Valuation calculator, and Your Properties.",
            position: "bottom",
        },
        {
            id: "trends",
            target: '[data-tour="trends-tab"]',
            title: "Market Trends",
            content: "View market analytics including cap rates, price trends, and neighborhood heatmaps.",
            position: "bottom",
        },
    ];

    return (
        <div className="relative flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Analytics</h1>

                    {/* View Tabs */}
                    <div data-tour="view-tabs" className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <ViewTab
                            data-tour="trends-tab"
                            active={activeView === "trends"}
                            icon={TrendingUp}
                            label="Trends"
                            onClick={() => setActiveView("trends")}
                        />
                        <ViewTab
                            active={activeView === "map"}
                            icon={Map}
                            label="Map"
                            onClick={() => setActiveView("map")}
                        />
                        <ViewTab
                            active={activeView === "comps"}
                            icon={BarChart3}
                            label="Comps"
                            onClick={() => setActiveView("comps")}
                        />
                        <ViewTab
                            active={activeView === "valuation"}
                            icon={Calculator}
                            label="Valuation"
                            onClick={() => setActiveView("valuation")}
                        />
                        <ViewTab
                            active={activeView === "properties"}
                            icon={Building2}
                            label="Your Properties"
                            onClick={() => setActiveView("properties")}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {activeView === "trends" && <TrendsView />}
                {activeView === "map" && (
                    <MapView
                        properties={properties}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        loading={loading}
                        page={page}
                        totalCount={totalCount}
                        totalPages={totalPages}
                        handlePageChange={handlePageChange}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        setPage={setPage}
                        filters={filters}
                        setFilters={setFilters}
                        filtersOpen={filtersOpen}
                        setFiltersOpen={setFiltersOpen}
                        activeFilterCount={activeFilterCount}
                        clearFilters={clearFilters}
                        mapListingSource={mapListingSource}
                        setMapListingSource={setMapListingSource}
                        setMapBounds={setMapBounds}
                    />
                )}
                {activeView === "comps" && <CompsView />}
                {activeView === "valuation" && <ValuationView />}
                {activeView === "properties" && <YourPropertiesView />}
            </div>

            {/* Guided Tour */}
            <GuidedTour
                steps={tourSteps}
                isOpen={isTourOpen}
                onClose={() => setIsTourOpen(false)}
                onComplete={() => {
                    console.log("Analytics tour completed!");
                }}
            />
        </div>
    );
}
