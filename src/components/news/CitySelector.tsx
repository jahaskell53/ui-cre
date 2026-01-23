"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { searchCities } from "@mardillu/us-cities-utils";
import { UsCity } from "@/lib/news/cities";
import { X } from "lucide-react";

interface CitySelectorProps {
  selectedCities: UsCity[];
  onChange: (cities: UsCity[]) => void;
  placeholder?: string;
}

export default function CitySelector({
  selectedCities,
  onChange,
  placeholder = "Search to add cities...",
}: CitySelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
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
    const exists = selectedCities.some(
      (c) => c.name === city.name && c.stateAbbr === city.stateAbbr
    );
    if (!exists) {
      onChange([...selectedCities, city]);
    }
    setSearchTerm("");
    setIsOpen(false);
  };

  const removeCity = (cityToRemove: UsCity) => {
    const newCities = selectedCities.filter(
      (c) =>
        !(c.name === cityToRemove.name && c.stateAbbr === cityToRemove.stateAbbr)
    );
    onChange(newCities);
  };

  return (
    <div className="w-full space-y-4" ref={wrapperRef}>
      {/* Selected Cities List */}
      {selectedCities.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedCities.map((city, idx) => (
            <span
              key={`${city.name}-${city.stateAbbr}-${idx}`}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            >
              {city.name}, {city.stateAbbr}
              <button
                type="button"
                onClick={() => removeCity(city)}
                className="ml-2 focus:outline-none hover:text-gray-900 dark:hover:text-gray-100"
                aria-label={`Remove ${city.name}`}
              >
                <X className="w-4 h-4" />
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
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Dropdown */}
        {isOpen && searchTerm.trim() && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.length > 0 ? (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 sticky top-0">
                  Cities
                </div>
                {searchResults.map((city: UsCity, idx: number) => (
                  <button
                    key={`${city.name}-${city.stateAbbr}-${idx}`}
                    type="button"
                    onClick={() => addCity(city)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex justify-between items-center"
                  >
                    <span>
                      {city.name}, {city.stateAbbr}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                      {city.county ? `${city.county} County` : ""}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {debouncedSearchTerm.length < 2
                  ? "Type at least 2 characters"
                  : "No cities found"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
