"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { METRO_AREAS, MetroArea, County } from "@/lib/news/metro-areas";
import { X } from "lucide-react";

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
  [] as (County & { metroName: string; metroId: string })[]
);

export default function LocationSelector({
  selectedLocations,
  onChange,
  placeholder = "Search to add regions...",
}: LocationSelectorProps) {
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
      (c) =>
        !selectedLocations.includes(c.id) &&
        (c.name.toLowerCase().includes(lowerTerm) ||
          c.metroName.toLowerCase().includes(lowerTerm))
    );

    // Search metros
    const matchingMetros = METRO_AREAS.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerTerm) &&
        !m.counties.every((c) => selectedLocations.includes(c.id))
    );

    return { counties: matchingCounties, metros: matchingMetros };
  }, [searchTerm, selectedLocations]);

  const addLocation = (id: string) => {
    const cleanLocations = selectedLocations.filter(
      (l) => !l.startsWith("metro:")
    );
    if (!cleanLocations.includes(id)) {
      onChange([...cleanLocations, id]);
    }
    setSearchTerm("");
    setIsOpen(false);
  };

  const addMetro = (metro: MetroArea) => {
    const cleanLocations = selectedLocations.filter(
      (l) => !l.startsWith("metro:")
    );
    const newIds = metro.counties
      .map((c) => c.id)
      .filter((id) => !cleanLocations.includes(id));
    onChange([...cleanLocations, ...newIds]);
    setSearchTerm("");
    setIsOpen(false);
  };

  const removeLocation = (id: string) => {
    const newLocations = selectedLocations.filter(
      (l) => l !== id && !l.startsWith("metro:")
    );
    onChange(newLocations);
  };

  return (
    <div className="w-full space-y-4" ref={wrapperRef}>
      {/* Selected Counties List */}
      {selectedCounties.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedCounties.map((county) => (
            <span
              key={county.id}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-50 text-orange-800 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-200 dark:border-orange-800"
            >
              {county.name}
              <button
                type="button"
                onClick={() => removeLocation(county.id)}
                className="ml-2 focus:outline-none hover:text-orange-900 dark:hover:text-orange-100"
                aria-label={`Remove ${county.name}`}
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
            {searchResults.metros.length > 0 ||
            searchResults.counties.length > 0 ? (
              <>
                {searchResults.metros.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 sticky top-0">
                      Metro Areas
                    </div>
                    {searchResults.metros.map((metro) => (
                      <button
                        key={metro.id}
                        type="button"
                        onClick={() => addMetro(metro)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex justify-between items-center"
                      >
                        <span>{metro.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                          All counties
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {searchResults.counties.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 sticky top-0">
                      Counties
                    </div>
                    {searchResults.counties.map((county) => (
                      <button
                        key={`${county.id}-${county.metroId}`}
                        type="button"
                        onClick={() => addLocation(county.id)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex justify-between items-center"
                      >
                        <span>{county.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                          {county.metroName}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </>
            ) : (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                No locations found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
