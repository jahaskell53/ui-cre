"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { TrendUp02 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";

export default function MarketIntelligencePage() {
    const [selectedState, setSelectedState] = useState<SelectItemType | null>({
        id: "CA",
        label: "California",
    });
    const [selectedCounty, setSelectedCounty] = useState<SelectItemType | null>({
        id: "colusa",
        label: "Colusa",
    });
    const [selectedCity, setSelectedCity] = useState<SelectItemType | null>(null);

    const states: SelectItemType[] = [
        { id: "CA", label: "California" },
        { id: "TX", label: "Texas" },
        { id: "FL", label: "Florida" },
        { id: "NY", label: "New York" },
        { id: "AZ", label: "Arizona" },
    ];

    const counties: SelectItemType[] = selectedState?.id === "CA" 
        ? [
            { id: "colusa", label: "Colusa" },
            { id: "los-angeles", label: "Los Angeles" },
            { id: "san-francisco", label: "San Francisco" },
            { id: "san-diego", label: "San Diego" },
            { id: "orange", label: "Orange" },
        ]
        : [];

    const cities: SelectItemType[] = selectedCounty?.id === "colusa"
        ? [
            { id: "colusa-city", label: "Colusa" },
            { id: "williams", label: "Williams" },
            { id: "arbuckle", label: "Arbuckle" },
        ]
        : [];

    const marketData = {
        location: `${selectedCounty?.label || ""} County, ${selectedState?.id || ""}`,
        tiles: [
            {
                label: "Number of Sales",
                value: "285",
                subtitle: "Last 18 months",
            },
            {
                label: "Median Sale Price",
                value: "$362,500",
                subtitle: "Avg: $417,868",
            },
            {
                label: "Vacancy Rate",
                value: "3.4%",
                trend: "up",
            },
            {
                label: "Price per Sq Ft",
                value: "$229",
                subtitle: "Avg size: 2,034 sqft",
            },
            {
                label: "YoY Price Change",
                value: "2.6%",
                subtitle: "vs. prior year",
            },
            {
                label: "Total Properties",
                value: "10,126",
                subtitle: "In this area",
            },
            {
                label: "Avg Beds / Baths",
                value: "2.8 / 1.7",
                subtitle: "Bedrooms / Bathrooms",
            },
            {
                label: "Sales Momentum",
                value: "94%",
                subtitle: "6mo vs prior 6mo",
            },
        ],
    };

    return (
        <MainLayout>
            <div className="flex flex-col gap-10">
                <div>
                    <h1 className="text-display-sm font-semibold text-primary">Market Intelligence</h1>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Select
                        label="State"
                        items={states}
                        selectedKey={selectedState?.id}
                        onSelectionChange={(key) => {
                            const state = states.find(s => s.id === key);
                            setSelectedState(state || null);
                            setSelectedCounty(null);
                            setSelectedCity(null);
                        }}
                        className="w-full sm:w-48"
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} />}
                    </Select>

                    <Select
                        label="County"
                        items={counties}
                        selectedKey={selectedCounty?.id}
                        onSelectionChange={(key) => {
                            const county = counties.find(c => c.id === key);
                            setSelectedCounty(county || null);
                            setSelectedCity(null);
                        }}
                        isDisabled={!selectedState}
                        className="w-full sm:w-48"
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} />}
                    </Select>

                    <Select
                        label="City"
                        items={cities}
                        selectedKey={selectedCity?.id}
                        onSelectionChange={(key) => {
                            const city = cities.find(c => c.id === key);
                            setSelectedCity(city || null);
                        }}
                        isDisabled={!selectedCounty}
                        className="w-full sm:w-48"
                    >
                        {(item) => <Select.Item id={item.id} label={item.label} />}
                    </Select>
                </div>

                {marketData.location && (
                    <p className="text-lg text-tertiary">{marketData.location}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {marketData.tiles.map((tile, i) => (
                        <div
                            key={i}
                            className="bg-primary border border-secondary p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-sm font-bold text-quaternary uppercase tracking-widest">{tile.label}</p>
                                {tile.trend === "up" && (
                                    <Badge color="success" size="sm" type="pill-color" className="gap-1 px-1.5 py-0.5">
                                        <TrendUp02 className="size-3" />
                                    </Badge>
                                )}
                            </div>
                            <h3 className="text-3xl font-bold text-primary tracking-tight mb-2">{tile.value}</h3>
                            {tile.subtitle && (
                                <p className="text-sm text-tertiary">{tile.subtitle}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}

