"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TextField } from "@/components/base/input/input";
import { InputBase } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { HintText } from "@/components/base/input/hint-text";
import { SearchLg } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import type { TextFieldProps } from "react-aria-components";

interface AddressSuggestion {
    id: string;
    address: string;
    fullAddress: string;
    coordinates: [number, number];
    context?: any[];
}

interface AddressInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    hint?: string;
    isRequired?: boolean;
    isDisabled?: boolean;
    className?: string;
}

export const AddressInput = ({
    label,
    value,
    onChange,
    placeholder = "Search for an address...",
    hint,
    isRequired,
    isDisabled,
    className,
}: AddressInputProps) => {
    const [searchQuery, setSearchQuery] = useState(value);
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout>();

    // Sync external value with internal search query
    useEffect(() => {
        setSearchQuery(value);
    }, [value]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchSuggestions = useCallback(async (query: string) => {
        if (!query || query.trim().length < 3) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error("Failed to fetch suggestions");
            }
            const data = await response.json();
            setSuggestions(data.suggestions || []);
            setIsOpen(data.suggestions && data.suggestions.length > 0);
        } catch (error) {
            console.error("Error fetching address suggestions:", error);
            setSuggestions([]);
            setIsOpen(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleInputChange = (newValue: string) => {
        setSearchQuery(newValue);
        onChange(newValue);

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce API calls
        debounceTimerRef.current = setTimeout(() => {
            fetchSuggestions(newValue);
        }, 300);
    };

    const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
        setSearchQuery(suggestion.fullAddress);
        onChange(suggestion.fullAddress);
        setIsOpen(false);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                break;
            case "Enter":
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    handleSelectSuggestion(suggestions[selectedIndex]);
                }
                break;
            case "Escape":
                setIsOpen(false);
                setSelectedIndex(-1);
                break;
        }
    };

    return (
        <div ref={wrapperRef} className={cx("relative w-full", className)}>
            <TextField 
                aria-label={!label ? placeholder : undefined} 
                isRequired={isRequired} 
                isDisabled={isDisabled}
                value={searchQuery}
                onChange={handleInputChange}
            >
                {({ isInvalid }) => (
                    <>
                        {label && <Label>{label}</Label>}
                        <div className="relative">
                            <InputBase
                                ref={inputRef}
                                placeholder={placeholder}
                                onFocus={() => {
                                    if (suggestions.length > 0) {
                                        setIsOpen(true);
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                                icon={SearchLg}
                                isDisabled={isDisabled}
                                isInvalid={isInvalid}
                            />
                            {isLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="size-4 animate-spin rounded-full border-2 border-secondary border-t-brand" />
                                </div>
                            )}
                        </div>
                        {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
                    </>
                )}
            </TextField>

            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-secondary bg-primary shadow-lg">
                    <div className="max-h-60 overflow-y-auto">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => handleSelectSuggestion(suggestion)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={cx(
                                    "w-full px-3 py-2 text-left text-sm transition-colors",
                                    index === selectedIndex
                                        ? "bg-secondary/10 text-primary"
                                        : "text-secondary hover:bg-secondary/5"
                                )}
                            >
                                <div className="font-medium text-primary">{suggestion.address}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

