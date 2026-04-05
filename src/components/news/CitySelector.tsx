"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchCities } from "@mardillu/us-cities-utils";
import { X } from "lucide-react";
import { UsCity } from "@/lib/news/cities";

interface CitySelectorProps {
    selectedCities: UsCity[];
    onChange: (cities: UsCity[]) => void;
    placeholder?: string;
}

export default function CitySelector({ selectedCities, onChange, placeholder = "Search to add cities..." }: CitySelectorProps) {
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

    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const searchResults = useMemo(() => {
        if (!debouncedSearchTerm.trim() || debouncedSearchTerm.length < 2) return [];

        // Search cities using the package
        // Limit to 20 results to avoid overwhelming the UI
        return searchCities(debouncedSearchTerm).slice(0, 20);
    }, [debouncedSearchTerm]);

    const addCity = (city: UsCity) => {
        // Check if already selected (by name and state)
        const exists = selectedCities.some((c) => c.name === city.name && c.stateAbbr === city.stateAbbr);
        if (!exists) {
            onChange([...selectedCities, city]);
        }
        setSearchTerm("");
        setIsOpen(false);
    };

    const removeCity = (cityToRemove: UsCity) => {
        const newCities = selectedCities.filter((c) => !(c.name === cityToRemove.name && c.stateAbbr === cityToRemove.stateAbbr));
        onChange(newCities);
    };

    return (
        <div className="w-full space-y-4" ref={wrapperRef}>
            {/* Selected Cities List */}
            {selectedCities.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {selectedCities.map((city, idx) => (
                        <span
                            key={`${city.name}-${city.stateAbbr}-${idx}`}
                            className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                        >
                            {city.name}, {city.stateAbbr}
                            <button
                                type="button"
                                onClick={() => removeCity(city)}
                                className="ml-2 hover:text-gray-900 focus:outline-none dark:hover:text-gray-100"
                                aria-label={`Remove ${city.name}`}
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
                        {searchResults.length > 0 ? (
                            <>
                                <div className="sticky top-0 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                    Cities
                                </div>
                                {searchResults.map((city: UsCity, idx: number) => (
                                    <button
                                        key={`${city.name}-${city.stateAbbr}-${idx}`}
                                        type="button"
                                        onClick={() => addCity(city)}
                                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <span>
                                            {city.name}, {city.stateAbbr}
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{city.county ? `${city.county} County` : ""}</span>
                                    </button>
                                ))}
                            </>
                        ) : (
                            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                {debouncedSearchTerm.length < 2 ? "Type at least 2 characters" : "No cities found"}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
