"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { County, METRO_AREAS, MetroArea } from "@/lib/news/metro-areas";

interface LocationSelectorProps {
    selectedLocations: string[];
    onChange: (locations: string[]) => void;
    placeholder?: string;
}

// Helper to flatten counties for easy lookup
const ALL_COUNTIES = METRO_AREAS.reduce(
    (acc, metro) => {
        metro.counties.forEach((county) => {
            acc.push({ ...county, metroName: metro.name, metroId: metro.id });
        });
        return acc;
    },
    [] as (County & { metroName: string; metroId: string })[],
);

export default function LocationSelector({ selectedLocations, onChange, placeholder = "Search to add regions..." }: LocationSelectorProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const selectedCounties = useMemo(() => {
        const unique = new Map<string, (typeof ALL_COUNTIES)[0]>();
        ALL_COUNTIES.forEach((c) => {
            if (selectedLocations.includes(c.id)) {
                if (!unique.has(c.id)) {
                    unique.set(c.id, c);
                }
            }
        });
        return Array.from(unique.values());
    }, [selectedLocations]);

    const searchResults = useMemo(() => {
        if (!searchTerm.trim()) return { counties: [], metros: [] };

        const lowerTerm = searchTerm.toLowerCase();

        // Search counties
        const matchingCounties = ALL_COUNTIES.filter(
            (c) => !selectedLocations.includes(c.id) && (c.name.toLowerCase().includes(lowerTerm) || c.metroName.toLowerCase().includes(lowerTerm)),
        );

        // Search metros
        const matchingMetros = METRO_AREAS.filter(
            (m) => m.name.toLowerCase().includes(lowerTerm) && !m.counties.every((c) => selectedLocations.includes(c.id)),
        );

        return { counties: matchingCounties, metros: matchingMetros };
    }, [searchTerm, selectedLocations]);

    const addLocation = (id: string) => {
        const cleanLocations = selectedLocations.filter((l) => !l.startsWith("metro:"));
        if (!cleanLocations.includes(id)) {
            onChange([...cleanLocations, id]);
        }
        setSearchTerm("");
        setIsOpen(false);
    };

    const addMetro = (metro: MetroArea) => {
        const cleanLocations = selectedLocations.filter((l) => !l.startsWith("metro:"));
        const newIds = metro.counties.map((c) => c.id).filter((id) => !cleanLocations.includes(id));
        onChange([...cleanLocations, ...newIds]);
        setSearchTerm("");
        setIsOpen(false);
    };

    const removeLocation = (id: string) => {
        const newLocations = selectedLocations.filter((l) => l !== id && !l.startsWith("metro:"));
        onChange(newLocations);
    };

    return (
        <div className="w-full space-y-4" ref={wrapperRef}>
            {/* Selected Counties List */}
            {selectedCounties.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {selectedCounties.map((county) => (
                        <span
                            key={county.id}
                            className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                        >
                            {county.name}
                            <button
                                type="button"
                                onClick={() => removeLocation(county.id)}
                                className="ml-2 hover:text-gray-900 focus:outline-none dark:hover:text-gray-100"
                                aria-label={`Remove ${county.name}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Search Input */}
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                />

                {/* Dropdown */}
                {isOpen && searchTerm.trim() && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                        {searchResults.metros.length > 0 || searchResults.counties.length > 0 ? (
                            <>
                                {searchResults.metros.length > 0 && (
                                    <>
                                        <div className="sticky top-0 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                            Metro Areas
                                        </div>
                                        {searchResults.metros.map((metro) => (
                                            <button
                                                key={metro.id}
                                                type="button"
                                                onClick={() => addMetro(metro)}
                                                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                                            >
                                                <span>{metro.name}</span>
                                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">All counties</span>
                                            </button>
                                        ))}
                                    </>
                                )}

                                {searchResults.counties.length > 0 && (
                                    <>
                                        <div className="sticky top-0 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                            Counties
                                        </div>
                                        {searchResults.counties.map((county) => (
                                            <button
                                                key={`${county.id}-${county.metroId}`}
                                                type="button"
                                                onClick={() => addLocation(county.id)}
                                                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                                            >
                                                <span>{county.name}</span>
                                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{county.metroName}</span>
                                            </button>
                                        ))}
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No locations found</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
