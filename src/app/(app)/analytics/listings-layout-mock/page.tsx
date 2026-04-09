"use client";

import { useState } from "react";
import { Filter, LayoutList, Map as MapIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const AREA_TYPES = [
    { value: "zip", label: "ZIP" },
    { value: "neighborhood", label: "Neighborhood" },
    { value: "city", label: "City" },
    { value: "county", label: "County" },
    { value: "msa", label: "MSA" },
    { value: "address", label: "Address" },
] as const;

type AreaType = (typeof AREA_TYPES)[number]["value"];

const PLACEHOLDERS: Record<AreaType, string> = {
    zip: "Enter zip code…",
    neighborhood: "Search neighborhood…",
    city: "Search city…",
    county: "Search county…",
    msa: "Search metro area…",
    address: "Search address or building…",
};

/**
 * Static layout proposal for the analytics listings page (mobile-first).
 * No data fetching — for design review only. Remove or replace after sign-off.
 */
export default function ListingsLayoutMockPage() {
    const [mode, setMode] = useState<"map" | "list">("map");
    const [areaType, setAreaType] = useState<AreaType>("zip");
    const [listingKind, setListingKind] = useState<"rent" | "sales">("rent");
    const [timeRange, setTimeRange] = useState<"latest" | "historical">("latest");

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-950">
            <div className="flex-shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Proposal mock only — visit{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] dark:bg-amber-900/60">/analytics/listings-layout-mock</code>
            </div>

            <div className="flex flex-shrink-0 flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="gap-2">
                                <Filter className="size-4" />
                                Filters
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Filters</DialogTitle>
                                <DialogDescription>Rent vs sales and time range live here in the real build.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-2">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Listing type</Label>
                                    <div className="mt-2 flex gap-1 rounded-lg bg-muted p-1">
                                        {(["rent", "sales"] as const).map((k) => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => setListingKind(k)}
                                                className={cn(
                                                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                                    listingKind === k
                                                        ? "bg-background text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground",
                                                )}
                                            >
                                                {k === "rent" ? "Rent" : "Sales"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Time range</Label>
                                    <div className="mt-2 flex gap-1 rounded-lg bg-muted p-1">
                                        {(["latest", "historical"] as const).map((k) => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => setTimeRange(k)}
                                                className={cn(
                                                    "flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors",
                                                    timeRange === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                                                )}
                                            >
                                                {k}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Price, beds, baths, cap rate, etc. would appear below in the real filters sheet.
                                </p>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <div className="flex rounded-lg border border-input bg-muted/40 p-0.5">
                        <button
                            type="button"
                            onClick={() => setMode("map")}
                            className={cn(
                                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                mode === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                            )}
                        >
                            <MapIcon className="size-4" />
                            Map
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("list")}
                            className={cn(
                                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                mode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                            )}
                        >
                            <LayoutList className="size-4" />
                            List
                        </button>
                    </div>
                </div>

                <div className="flex w-full min-w-0 rounded-lg border border-input shadow-xs">
                    <Select value={areaType} onValueChange={(v) => setAreaType(v as AreaType)}>
                        <SelectTrigger
                            size="sm"
                            className="h-10 w-[min(38%,11rem)] shrink-0 rounded-none rounded-l-lg border-0 border-r bg-muted/30 shadow-none focus:z-10"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {AREA_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder={PLACEHOLDERS[areaType]}
                            className="h-10 rounded-none rounded-r-lg border-0 pl-9 shadow-none focus-visible:ring-0"
                            aria-label="Area search"
                        />
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
                {mode === "map" ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <MapIcon className="size-12 opacity-40" />
                        <p className="text-sm font-medium">Map (placeholder)</p>
                        <p className="max-w-xs px-4 text-center text-xs">Default view would be the interactive map.</p>
                    </div>
                ) : (
                    <div className="h-full overflow-auto p-4">
                        <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Sample results</p>
                        <ul className="space-y-2">
                            {["123 Market St", "456 Oak Ave", "789 Bay Blvd"].map((name) => (
                                <li key={name} className="rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-xs">
                                    {name}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
