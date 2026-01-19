"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PropertyMap, type Property } from "@/components/application/map/property-map";

interface SelectOption {
    id: string;
    label: string;
}

export default function MarketIntelligencePage() {
    const [selectedState, setSelectedState] = useState<string>("CA");
    const [selectedCounty, setSelectedCounty] = useState<string>("colusa");
    const [selectedCity, setSelectedCity] = useState<string>("");

    const states: SelectOption[] = [
        { id: "CA", label: "California" },
        { id: "TX", label: "Texas" },
        { id: "FL", label: "Florida" },
        { id: "NY", label: "New York" },
        { id: "AZ", label: "Arizona" },
    ];

    const counties: SelectOption[] = selectedState === "CA"
        ? [
            { id: "colusa", label: "Colusa" },
            { id: "los-angeles", label: "Los Angeles" },
            { id: "san-francisco", label: "San Francisco" },
            { id: "san-diego", label: "San Diego" },
            { id: "orange", label: "Orange" },
        ]
        : [];

    const cities: SelectOption[] = selectedCounty === "colusa"
        ? [
            { id: "colusa-city", label: "Colusa" },
            { id: "williams", label: "Williams" },
            { id: "arbuckle", label: "Arbuckle" },
        ]
        : [];

    const getCountyLabel = () => counties.find(c => c.id === selectedCounty)?.label || "";
    const getStateLabel = () => states.find(s => s.id === selectedState)?.label || "";

    // Mock recent sales data for the selected region
    const recentSales: Property[] = selectedCounty === "colusa" ? [
        {
            id: 1,
            name: "Riverside Apartments",
            address: "123 Main St, Colusa, CA",
            location: "Colusa, CA",
            units: 24,
            price: "$2.4M",
            coordinates: [-122.1794, 39.2143],
            capRate: "6.2%",
            squareFootage: "18,500 sqft",
        },
        {
            id: 2,
            name: "Oak Grove Complex",
            address: "456 Oak Ave, Colusa, CA",
            location: "Colusa, CA",
            units: 16,
            price: "$1.8M",
            coordinates: [-122.1850, 39.2200],
            capRate: "5.8%",
            squareFootage: "12,200 sqft",
        },
        {
            id: 3,
            name: "Parkview Terrace",
            address: "789 Park Blvd, Williams, CA",
            location: "Williams, CA",
            units: 32,
            price: "$3.1M",
            coordinates: [-122.1490, 39.1540],
            capRate: "6.5%",
            squareFootage: "24,800 sqft",
        },
        {
            id: 4,
            name: "Sunset Gardens",
            address: "321 Sunset Dr, Colusa, CA",
            location: "Colusa, CA",
            units: 20,
            price: "$2.0M",
            coordinates: [-122.1720, 39.2080],
            capRate: "6.0%",
            squareFootage: "15,600 sqft",
        },
        {
            id: 5,
            name: "Arbuckle Heights",
            address: "654 Hill St, Arbuckle, CA",
            location: "Arbuckle, CA",
            units: 12,
            price: "$1.2M",
            coordinates: [-122.0570, 39.0170],
            capRate: "5.5%",
            squareFootage: "9,400 sqft",
        },
    ] : [];

    const marketData = {
        location: `${getCountyLabel()} County, ${selectedState}`,
        tiles: [
            {
                label: "Number of Sales",
                value: "285",
                subtitle: "Last 18 months",
                trend: "up" as const,
                isPositive: true,
            },
            {
                label: "Median Sale Price",
                value: "$362,500",
                subtitle: "Avg: $417,868",
                trend: "up" as const,
                isPositive: true,
            },
            {
                label: "Vacancy Rate",
                value: "3.4%",
                trend: "up" as const,
                isPositive: false,
            },
            {
                label: "Price per Sq Ft",
                value: "$229",
                subtitle: "Avg size: 2,034 sqft",
                trend: "up" as const,
                isPositive: true,
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
        <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6">
                <div className="max-w-7xl mx-auto w-full flex flex-col gap-10">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Market Intelligence</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Deep insights into regional multi-family market trends.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 p-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
                        <div className="w-full sm:w-48 space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">State</Label>
                            <Select
                                value={selectedState}
                                onValueChange={(value) => {
                                    setSelectedState(value);
                                    setSelectedCounty("");
                                    setSelectedCity("");
                                }}
                            >
                                <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 h-10 font-medium">
                                    <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                    {states.map((state) => (
                                        <SelectItem key={state.id} value={state.id}>
                                            {state.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-full sm:w-48 space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">County</Label>
                            <Select
                                value={selectedCounty}
                                onValueChange={(value) => {
                                    setSelectedCounty(value);
                                    setSelectedCity("");
                                }}
                                disabled={!selectedState}
                            >
                                <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 h-10 font-medium">
                                    <SelectValue placeholder="Select county" />
                                </SelectTrigger>
                                <SelectContent>
                                    {counties.map((county) => (
                                        <SelectItem key={county.id} value={county.id}>
                                            {county.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-full sm:w-48 space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">City</Label>
                            <Select
                                value={selectedCity}
                                onValueChange={setSelectedCity}
                                disabled={!selectedCounty}
                            >
                                <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 h-10 font-medium">
                                    <SelectValue placeholder="Select city" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cities.map((city) => (
                                        <SelectItem key={city.id} value={city.id}>
                                            {city.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {marketData.location && (
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 px-4">{marketData.location}</p>
                            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {marketData.tiles.map((tile, i) => (
                            <div
                                key={i}
                                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{tile.label}</p>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    {tile.trend && (
                                        <div className={tile.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                            {tile.trend === "up" ? (
                                                <ArrowUp className="size-5" />
                                            ) : (
                                                <ArrowDown className="size-5" />
                                            )}
                                        </div>
                                    )}
                                    <h3 className={`text-3xl font-bold tracking-tight ${tile.trend && tile.isPositive ? 'text-green-600 dark:text-green-400' : tile.trend && !tile.isPositive ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                        {tile.value}
                                    </h3>
                                </div>
                                {tile.subtitle && (
                                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
                                        <span className="size-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
                                        {tile.subtitle}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {selectedCounty && selectedState && (
                        <div className="flex flex-col gap-6">
                            <div className="flex items-end justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                        Recent Sales
                                    </h2>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">{getCountyLabel()} County, {selectedState} • Last 18 Months</p>
                                </div>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm" style={{ height: '500px' }}>
                                <PropertyMap
                                    properties={recentSales}
                                    className="w-full h-full"
                                />
                            </div>
                        </div>
                    )}

                    {selectedCounty === "colusa" && selectedState === "CA" && (
                        <div className="flex flex-col gap-10">
                            {/* Sale Volume by Cities Bar Chart */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
                                <div className="mb-10">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sale Volume by Cities</h2>
                                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest">{getCountyLabel().toUpperCase()} County • Price/Sq Ft</p>
                                </div>
                                <div className="w-full">
                                    <svg viewBox="0 0 600 300" className="w-full h-auto">
                                        {/* Y-axis labels */}
                                        {[0, 35, 70, 105, 140].map((val, i) => (
                                            <g key={i}>
                                                <line x1="50" y1={250 - (val / 140) * 200} x2="550" y2={250 - (val / 140) * 200} stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="1" strokeDasharray="4,4" />
                                                <text x="40" y={250 - (val / 140) * 200 + 4} textAnchor="end" className="text-[10px] font-bold fill-gray-400 dark:fill-gray-500">{val}</text>
                                            </g>
                                        ))}
                                        {/* Bars */}
                                        {[
                                            { name: 'Arbuckle', val: 120, x: 100 },
                                            { name: 'Williams', val: 95, x: 250 },
                                            { name: 'Colusa', val: 110, x: 400 },
                                        ].map((bar, i) => (
                                            <g key={i}>
                                                <rect x={bar.x} y={250 - (bar.val / 140) * 200} width="100" height={(bar.val / 140) * 200} fill="currentColor" className="text-gray-900 dark:text-gray-100" rx="6" />
                                                <text x={bar.x + 50} y={250 - (bar.val / 140) * 200 - 12} textAnchor="middle" className="text-xs font-bold fill-gray-900 dark:fill-gray-100">${bar.val}</text>
                                                <text x={bar.x + 50} y="280" textAnchor="middle" className="text-[10px] font-bold uppercase tracking-widest fill-gray-500 dark:fill-gray-400">{bar.name}</text>
                                            </g>
                                        ))}
                                    </svg>
                                </div>
                            </div>

                            {/* Average Home Price Comparison Line Chart */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
                                <div className="mb-10">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Average Home Price Comparison</h2>
                                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest">{getCountyLabel()} County vs CA State Average (30 Years)</p>
                                </div>
                                <div className="w-full">
                                    <svg viewBox="0 0 800 400" className="w-full h-auto">
                                        {/* Y-axis labels */}
                                        {[0, 300000, 600000, 900000, 1200000].map((val, i) => {
                                            const y = 350 - (val / 1200000) * 300;
                                            return (
                                                <g key={i}>
                                                    <line x1="80" y1={y} x2="750" y2={y} stroke="currentColor" className="text-gray-100 dark:text-gray-800" strokeWidth="1" strokeDasharray="4,4" />
                                                    <text x="70" y={y + 4} textAnchor="end" className="text-[10px] font-bold fill-gray-400 dark:fill-gray-500">
                                                        ${val === 0 ? '0' : val === 300000 ? '300K' : val === 600000 ? '600K' : val === 900000 ? '900K' : '1.2M'}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                        {/* X-axis labels */}
                                        {['2003', '2007', '2011', '2015', '2019', '2023'].map((year, i) => {
                                            const x = 80 + (i / 5) * 670;
                                            return (
                                                <text key={i} x={x} y="380" textAnchor="middle" className="text-[10px] font-bold fill-gray-400 dark:fill-gray-500">{year}</text>
                                            );
                                        })}
                                        {/* County line */}
                                        <polyline
                                            points="80,320 150,310 220,290 290,280 360,270 430,260 500,250 570,240 640,230 710,220 750,210"
                                            fill="none"
                                            stroke="currentColor"
                                            className="text-gray-900 dark:text-gray-100"
                                            strokeWidth="3"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                        />
                                        {/* State line */}
                                        <polyline
                                            points="80,300 150,295 220,285 290,275 360,265 430,255 500,245 570,235 640,225 710,215 750,205"
                                            fill="none"
                                            stroke="currentColor"
                                            className="text-gray-300 dark:text-gray-600"
                                            strokeWidth="2"
                                            strokeDasharray="6,6"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                        />
                                        {/* Legend */}
                                        <g transform="translate(560, 40)">
                                            <rect width="180" height="60" rx="12" fill="currentColor" className="text-gray-50 dark:text-gray-800/50" />
                                            <line x1="20" y1="20" x2="45" y2="20" stroke="currentColor" className="text-gray-900 dark:text-gray-100" strokeWidth="3" />
                                            <text x="55" y="24" className="text-[10px] font-bold uppercase tracking-widest fill-gray-900 dark:fill-gray-100">Colusa County</text>
                                            <line x1="20" y1="40" x2="45" y2="40" stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth="2" strokeDasharray="4,4" />
                                            <text x="55" y="44" className="text-[10px] font-bold uppercase tracking-widest fill-gray-400 dark:fill-gray-500">CA State Avg</text>
                                        </g>
                                    </svg>
                                </div>
                            </div>

                            {/* Sales Price By ZIP Code Table */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                                <div className="p-8 border-b border-gray-100 dark:border-gray-800">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sales Price By ZIP Code</h2>
                                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest">{getCountyLabel()} County • Last 18 Months</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                            <tr>
                                                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ZIP Code</th>
                                                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">City</th>
                                                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Median Price</th>
                                                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Avg Price</th>
                                                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Sales Count</th>
                                                <th className="px-8 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Price/Sq Ft</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {[
                                                { zip: '95932', city: 'Colusa', median: '$385,000', avg: '$412,500', count: 42, priceSqFt: '$229' },
                                                { zip: '95987', city: 'Williams', median: '$342,000', avg: '$368,200', count: 38, priceSqFt: '$195' },
                                                { zip: '95912', city: 'Arbuckle', median: '$298,000', avg: '$325,800', count: 28, priceSqFt: '$178' },
                                                { zip: '95934', city: 'Colusa', median: '$410,000', avg: '$435,200', count: 35, priceSqFt: '$245' },
                                                { zip: '95988', city: 'Williams', median: '$365,000', avg: '$389,500', count: 31, priceSqFt: '$212' },
                                            ].map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                                                    <td className="px-8 py-5">
                                                        <span className="font-bold text-gray-900 dark:text-gray-100">{row.zip}</span>
                                                    </td>
                                                    <td className="px-8 py-5 text-gray-500 dark:text-gray-400 font-medium">
                                                        {row.city}
                                                    </td>
                                                    <td className="px-8 py-5 text-right font-bold text-gray-900 dark:text-gray-100">
                                                        {row.median}
                                                    </td>
                                                    <td className="px-8 py-5 text-right text-gray-500 dark:text-gray-400 font-medium">
                                                        {row.avg}
                                                    </td>
                                                    <td className="px-8 py-5 text-right text-gray-500 dark:text-gray-400 font-medium">
                                                        {row.count}
                                                    </td>
                                                    <td className="px-8 py-5 text-right font-bold text-gray-900 dark:text-gray-100">
                                                        {row.priceSqFt}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
