"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    AREA_TYPE_LABELS,
    AREA_TYPE_PLACEHOLDERS,
    type AreaFilter,
    type AreaType,
    BATH_OPTIONS,
    BED_OPTIONS,
    type Filters,
    type MapListingSource,
} from "@/lib/analytics/map-page";
import { cn } from "@/lib/utils";

export interface MapboxFeature {
    id: string;
    text: string;
    place_name: string;
    center: [number, number];
    bbox?: [number, number, number, number];
    context?: Array<{ id: string; text: string; short_code?: string }>;
}

export type AreaSuggestion =
    | { kind: "neighborhood"; id: number; name: string; city: string; state: string }
    | { kind: "mapbox"; feature: MapboxFeature }
    | { kind: "msa"; id: number; geoid: string; name: string; name_lsad: string }
    | { kind: "zip"; feature: MapboxFeature }
    | { kind: "address"; feature: MapboxFeature };

export function MapAreaSearchSection({
    variant,
    areaType,
    setAreaType,
    areaFilter,
    setAreaFilter,
    areaInput,
    setAreaInput,
    areaSuggestions,
    showSuggestions,
    setShowSuggestions,
    setAreaSuggestions,
    inputWrapperRef,
    clearAreaFilter,
    commitZip,
    commitAddressText,
    selectSuggestion,
}: {
    variant: "toolbar" | "menu";
    areaType: AreaType;
    setAreaType: (t: AreaType) => void;
    areaFilter: AreaFilter | null;
    setAreaFilter: (v: AreaFilter | null) => void;
    areaInput: string;
    setAreaInput: (v: string) => void;
    areaSuggestions: AreaSuggestion[];
    showSuggestions: boolean;
    setShowSuggestions: (v: boolean) => void;
    setAreaSuggestions: Dispatch<SetStateAction<AreaSuggestion[]>>;
    inputWrapperRef: RefObject<HTMLDivElement | null>;
    clearAreaFilter: () => void;
    commitZip: (zip: string) => void;
    commitAddressText: (query: string) => void;
    selectSuggestion: (s: AreaSuggestion) => void | Promise<void>;
}) {
    const resetAreaOnTypeChange = (type: AreaType) => {
        setAreaType(type);
        setAreaFilter(null);
        setAreaInput("");
        setAreaSuggestions([]);
        setShowSuggestions(false);
    };

    const typeRow =
        variant === "toolbar" ? (
            <div className="flex flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 text-xs dark:border-gray-600">
                {(Object.keys(AREA_TYPE_LABELS) as AreaType[]).map((type, i) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => resetAreaOnTypeChange(type)}
                        className={cn(
                            "px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors",
                            i > 0 && "border-l border-gray-200 dark:border-gray-600",
                            areaType === type
                                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700",
                        )}
                    >
                        {AREA_TYPE_LABELS[type]}
                    </button>
                ))}
            </div>
        ) : (
            <div className="flex flex-wrap gap-1 text-xs">
                {(Object.keys(AREA_TYPE_LABELS) as AreaType[]).map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => resetAreaOnTypeChange(type)}
                        className={cn(
                            "rounded-md border border-gray-200 px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors dark:border-gray-600",
                            areaType === type
                                ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                                : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700",
                        )}
                    >
                        {AREA_TYPE_LABELS[type]}
                    </button>
                ))}
            </div>
        );

    const searchBlock =
        areaFilter && (areaFilter.type !== "address" || areaFilter.bbox) ? (
            <div className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <MapPin className="size-3 flex-shrink-0" />
                <span className={cn("truncate", variant === "menu" ? "max-w-[min(100%,16rem)]" : "max-w-[180px]")}>{areaFilter.label}</span>
                <button type="button" onClick={clearAreaFilter} className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200">
                    <X className="size-3" />
                </button>
            </div>
        ) : (
            <div className={cn("relative", variant === "toolbar" ? "max-w-xs flex-1" : "w-full")} ref={inputWrapperRef}>
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                    inputMode={areaType === "zip" ? "numeric" : "text"}
                    placeholder={AREA_TYPE_PLACEHOLDERS[areaType]}
                    className={cn(
                        "h-8 border-gray-200 bg-gray-50 pl-9 text-sm dark:border-gray-700 dark:bg-gray-800",
                        areaType === "address" && areaInput && "pr-8",
                    )}
                    value={areaInput}
                    onChange={(e) => setAreaInput(e.target.value)}
                    onFocus={() => {
                        if (areaSuggestions.length > 0) setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && areaType === "zip") {
                            commitZip(areaInput);
                        } else if (e.key === "Enter" && areaType === "address") {
                            commitAddressText(areaInput);
                        } else if (e.key === "Escape") {
                            setShowSuggestions(false);
                        }
                    }}
                />
                {areaType === "address" && areaInput && (
                    <button
                        type="button"
                        onClick={clearAreaFilter}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
                {showSuggestions && areaSuggestions.length > 0 && (
                    <ul className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-hidden overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        {areaSuggestions.map((s, i) => {
                            const label =
                                s.kind === "neighborhood"
                                    ? `${s.name} · ${s.city}, ${s.state}`
                                    : s.kind === "msa"
                                      ? s.name_lsad || s.name
                                      : s.kind === "zip"
                                        ? s.feature.place_name
                                        : s.feature.place_name;
                            return (
                                <li
                                    key={i}
                                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectSuggestion(s);
                                    }}
                                >
                                    <MapPin className="size-3 flex-shrink-0 text-gray-400" />
                                    <span className="truncate">{label}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        );

    if (variant === "toolbar") {
        return (
            <div className="flex min-w-0 flex-1 items-center gap-2">
                {typeRow}
                {searchBlock}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {typeRow}
            {searchBlock}
        </div>
    );
}

export function MapFiltersFields({
    filters,
    setFilters,
    mapListingSource,
}: {
    filters: Filters;
    setFilters: Dispatch<SetStateAction<Filters>>;
    mapListingSource: MapListingSource;
}) {
    return (
        <div className="space-y-3">
            {mapListingSource === "zillow" && (
                <div>
                    <Label className="text-xs">Bedrooms</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {BED_OPTIONS.map(({ label, value }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() =>
                                    setFilters((prev) => ({
                                        ...prev,
                                        beds: prev.beds.includes(value) ? prev.beds.filter((b) => b !== value) : [...prev.beds, value],
                                    }))
                                }
                                className={cn(
                                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                    filters.beds.includes(value)
                                        ? "border-blue-600 bg-blue-600 text-white"
                                        : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {mapListingSource === "zillow" && (
                <div>
                    <Label className="text-xs">Bathrooms (min)</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {BATH_OPTIONS.map(({ label, value }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() =>
                                    setFilters((prev) => ({
                                        ...prev,
                                        bathsMin: prev.bathsMin === value ? null : value,
                                    }))
                                }
                                className={cn(
                                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                    filters.bathsMin === value
                                        ? "border-blue-600 bg-blue-600 text-white"
                                        : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {mapListingSource === "zillow" && (
                <div>
                    <Label className="text-xs">Segment</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {(
                            [
                                ["both", "All"],
                                ["reit", "REIT"],
                                ["mid", "Mid-market"],
                            ] as const
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setFilters((prev) => ({ ...prev, propertyType: value }))}
                                className={cn(
                                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                                    filters.propertyType === value
                                        ? "border-blue-600 bg-blue-600 text-white"
                                        : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div>
                <Label className="text-xs">Price Range</Label>
                <div className="mt-1 flex gap-2">
                    <Input
                        type="number"
                        placeholder="Min"
                        value={filters.priceMin}
                        onChange={(e) => {
                            setFilters((prev) => ({ ...prev, priceMin: e.target.value }));
                        }}
                        className="h-7 text-xs"
                    />
                    <Input
                        type="number"
                        placeholder="Max"
                        value={filters.priceMax}
                        onChange={(e) => {
                            setFilters((prev) => ({ ...prev, priceMax: e.target.value }));
                        }}
                        className="h-7 text-xs"
                    />
                </div>
            </div>
            {mapListingSource === "loopnet" && (
                <div>
                    <Label className="text-xs">Cap Rate (%)</Label>
                    <div className="mt-1 flex gap-2">
                        <Input
                            type="number"
                            placeholder="Min"
                            value={filters.capRateMin}
                            onChange={(e) => {
                                setFilters((prev) => ({ ...prev, capRateMin: e.target.value }));
                            }}
                            className="h-7 text-xs"
                        />
                        <Input
                            type="number"
                            placeholder="Max"
                            value={filters.capRateMax}
                            onChange={(e) => {
                                setFilters((prev) => ({ ...prev, capRateMax: e.target.value }));
                            }}
                            className="h-7 text-xs"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
