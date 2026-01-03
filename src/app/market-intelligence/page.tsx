"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { ArrowNarrowUp, ArrowNarrowDown } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { PropertyMap, type Property } from "@/components/application/map/property-map";

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

    // Mock recent sales data for the selected region
    const recentSales: Property[] = selectedCounty?.id === "colusa" ? [
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
        location: `${selectedCounty?.label || ""} County, ${selectedState?.id || ""}`,
        tiles: [
            {
                label: "Number of Sales",
                value: "285",
                subtitle: "Last 18 months",
                trend: "up",
                isPositive: true,
            },
            {
                label: "Median Sale Price",
                value: "$362,500",
                subtitle: "Avg: $417,868",
                trend: "up",
                isPositive: true,
            },
            {
                label: "Vacancy Rate",
                value: "3.4%",
                trend: "up",
                isPositive: false,
            },
            {
                label: "Price per Sq Ft",
                value: "$229",
                subtitle: "Avg size: 2,034 sqft",
                trend: "up",
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
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                {tile.trend && (
                                    <div className={tile.isPositive ? 'text-utility-success-700' : 'text-utility-error-700'}>
                                        {tile.trend === "up" ? (
                                            <ArrowNarrowUp className="size-5" />
                                        ) : (
                                            <ArrowNarrowDown className="size-5" />
                                        )}
                                    </div>
                                )}
                                <h3 className={`text-3xl font-bold tracking-tight ${tile.trend && tile.isPositive ? 'text-utility-success-700' : tile.trend && !tile.isPositive ? 'text-utility-error-700' : 'text-primary'}`}>
                                    {tile.value}
                                </h3>
                            </div>
                            {tile.subtitle && (
                                <p className="text-sm text-tertiary">{tile.subtitle}</p>
                            )}
                        </div>
                    ))}
                </div>

                {selectedCounty && selectedState && (
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="text-xl font-semibold text-primary">
                                Recent Sales {selectedCounty.label} County, {selectedState.id}
                            </h2>
                            <p className="text-sm text-tertiary mt-1">Last 18 Months</p>
                        </div>
                        <div className="border border-secondary rounded-2xl overflow-hidden bg-primary shadow-sm" style={{ height: '600px' }}>
                            <PropertyMap
                                properties={recentSales}
                                className="w-full h-full"
                            />
                        </div>
                    </div>
                )}

                {selectedCounty?.id === "colusa" && selectedState?.id === "CA" && (
                    <div className="flex flex-col gap-10">
                        {/* Sale Volume by Cities Bar Chart */}
                        <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-primary">Sale Volume by Cities in {selectedCounty?.label?.toUpperCase() || ''} County</h2>
                                <p className="text-sm text-tertiary mt-1">Price/Sq Ft</p>
                                <p className="text-xs text-quaternary mt-1">Last 18 Months, min. 50 sales</p>
                            </div>
                            <div className="w-full">
                                <svg viewBox="0 0 600 300" className="w-full h-auto">
                                    {/* Y-axis labels */}
                                    {[0, 35, 70, 105, 140].map((val, i) => (
                                        <g key={i}>
                                            <line x1="50" y1={250 - (val / 140) * 200} x2="550" y2={250 - (val / 140) * 200} stroke="#E4E7EC" strokeWidth="1" strokeDasharray="2,2" />
                                            <text x="45" y={250 - (val / 140) * 200 + 4} textAnchor="end" className="text-xs fill-quaternary" fontSize="12">{val}</text>
                                        </g>
                                    ))}
                                    {/* Bars */}
                                    <rect x="100" y={250 - (120 / 140) * 200} width="120" height={(120 / 140) * 200} fill="#7F56D9" rx="4" />
                                    <text x="160" y={250 - (120 / 140) * 200 - 8} textAnchor="middle" className="text-xs font-semibold fill-primary" fontSize="12">$120</text>
                                    <text x="160" y="285" textAnchor="middle" className="text-xs font-semibold fill-primary" fontSize="12">ARBUCKLE</text>

                                    <rect x="250" y={250 - (95 / 140) * 200} width="120" height={(95 / 140) * 200} fill="#7F56D9" rx="4" />
                                    <text x="310" y={250 - (95 / 140) * 200 - 8} textAnchor="middle" className="text-xs font-semibold fill-primary" fontSize="12">$95</text>
                                    <text x="310" y="285" textAnchor="middle" className="text-xs font-semibold fill-primary" fontSize="12">WILLIAMS</text>

                                    <rect x="400" y={250 - (110 / 140) * 200} width="120" height={(110 / 140) * 200} fill="#7F56D9" rx="4" />
                                    <text x="460" y={250 - (110 / 140) * 200 - 8} textAnchor="middle" className="text-xs font-semibold fill-primary" fontSize="12">$110</text>
                                    <text x="460" y="285" textAnchor="middle" className="text-xs font-semibold fill-primary" fontSize="12">COLUSA</text>
                                </svg>
                            </div>
                        </div>

                        {/* Average Home Price Comparison Line Chart */}
                        <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-primary">Average Home Price Comparison</h2>
                                <p className="text-sm text-tertiary mt-1">{selectedCounty.label} County, CA vs CA State Average (30 Years)</p>
                            </div>
                            <div className="w-full">
                                <svg viewBox="0 0 800 400" className="w-full h-auto">
                                    {/* Y-axis labels */}
                                    {[0, 300000, 600000, 900000, 1200000].map((val, i) => {
                                        const y = 350 - (val / 1200000) * 300;
                                        return (
                                            <g key={i}>
                                                <line x1="80" y1={y} x2="750" y2={y} stroke="#E4E7EC" strokeWidth="1" strokeDasharray="2,2" />
                                                <text x="75" y={y + 4} textAnchor="end" className="text-xs fill-quaternary" fontSize="11">
                                                    ${val === 0 ? '0' : val === 300000 ? '300K' : val === 600000 ? '600K' : val === 900000 ? '900K' : '1.2M'}
                                                </text>
                                            </g>
                                        );
                                    })}
                                    {/* X-axis labels */}
                                    {['2003', '2005', '2007', '2009', '2011', '2013', '2015', '2017', '2019', '2021', '2023', '2025'].map((year, i) => {
                                        const x = 80 + (i / 11) * 670;
                                        return (
                                            <text key={i} x={x} y="385" textAnchor="middle" className="text-xs fill-quaternary" fontSize="10">{year}</text>
                                        );
                                    })}
                                    {/* County line */}
                                    <polyline
                                        points="80,320 150,310 220,290 290,280 360,270 430,260 500,250 570,240 640,230 710,220 750,210"
                                        fill="none"
                                        stroke="#7F56D9"
                                        strokeWidth="3"
                                    />
                                    {/* State line */}
                                    <polyline
                                        points="80,300 150,295 220,285 290,275 360,265 430,255 500,245 570,235 640,225 710,215 750,205"
                                        fill="none"
                                        stroke="#98A2B3"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    />
                                    {/* Legend */}
                                    <g>
                                        <line x1="600" y1="50" x2="630" y2="50" stroke="#7F56D9" strokeWidth="3" />
                                        <text x="640" y="54" className="text-xs fill-secondary" fontSize="12">Colusa County</text>
                                        <line x1="600" y1="70" x2="630" y2="70" stroke="#98A2B3" strokeWidth="2" strokeDasharray="5,5" />
                                        <text x="640" y="74" className="text-xs fill-secondary" fontSize="12">CA State Average</text>
                                    </g>
                                </svg>
                            </div>
                        </div>

                        {/* Annual Sales Volume Comparison Line Chart */}
                        <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-primary">Annual Sales Volume Comparison</h2>
                                <p className="text-sm text-tertiary mt-1">{selectedCounty.label} County, CA vs CA State Volume (30 Years)</p>
                            </div>
                            <div className="w-full">
                                <svg viewBox="0 0 800 400" className="w-full h-auto">
                                    {/* Y-axis labels */}
                                    {[0, 250000, 500000, 750000, 1000000].map((val, i) => {
                                        const y = 350 - (val / 1000000) * 300;
                                        return (
                                            <g key={i}>
                                                <line x1="80" y1={y} x2="750" y2={y} stroke="#E4E7EC" strokeWidth="1" strokeDasharray="2,2" />
                                                <text x="75" y={y + 4} textAnchor="end" className="text-xs fill-quaternary" fontSize="11">
                                                    {val === 0 ? '0' : val === 250000 ? '250K' : val === 500000 ? '500K' : val === 750000 ? '750K' : '1M'}
                                                </text>
                                            </g>
                                        );
                                    })}
                                    {/* X-axis labels */}
                                    {['2003', '2005', '2007', '2009', '2011', '2013', '2015', '2017', '2019', '2021', '2023', '2025'].map((year, i) => {
                                        const x = 80 + (i / 11) * 670;
                                        return (
                                            <text key={i} x={x} y="385" textAnchor="middle" className="text-xs fill-quaternary" fontSize="10">{year}</text>
                                        );
                                    })}
                                    {/* County line */}
                                    <polyline
                                        points="80,340 150,330 220,320 290,310 360,300 430,290 500,280 570,270 640,260 710,250 750,240"
                                        fill="none"
                                        stroke="#7F56D9"
                                        strokeWidth="3"
                                    />
                                    {/* State line */}
                                    <polyline
                                        points="80,200 150,190 220,180 290,170 360,160 430,150 500,140 570,130 640,120 710,110 750,100"
                                        fill="none"
                                        stroke="#98A2B3"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    />
                                    {/* Legend */}
                                    <g>
                                        <line x1="600" y1="50" x2="630" y2="50" stroke="#7F56D9" strokeWidth="3" />
                                        <text x="640" y="54" className="text-xs fill-secondary" fontSize="12">Colusa County</text>
                                        <line x1="600" y1="70" x2="630" y2="70" stroke="#98A2B3" strokeWidth="2" strokeDasharray="5,5" />
                                        <text x="640" y="74" className="text-xs fill-secondary" fontSize="12">CA State Volume</text>
                                    </g>
                                </svg>
                            </div>
                        </div>

                        {/* Sales Price By ZIP Code Table */}
                        <div className="bg-primary border border-secondary rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-secondary">
                                <h2 className="text-xl font-semibold text-primary">Sales Price By ZIP Code {selectedCounty.label} County, CA</h2>
                                <p className="text-sm text-tertiary mt-1">Last 18 Months</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-secondary/50 border-b border-secondary">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest">ZIP Code</th>
                                            <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest">City</th>
                                            <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest text-right">Median Price</th>
                                            <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest text-right">Avg Price</th>
                                            <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest text-right">Sales Count</th>
                                            <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest text-right">Price/Sq Ft</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-secondary">
                                        {[
                                            { zip: '95932', city: 'Colusa', median: '$385,000', avg: '$412,500', count: 42, priceSqFt: '$229' },
                                            { zip: '95987', city: 'Williams', median: '$342,000', avg: '$368,200', count: 38, priceSqFt: '$195' },
                                            { zip: '95912', city: 'Arbuckle', median: '$298,000', avg: '$325,800', count: 28, priceSqFt: '$178' },
                                            { zip: '95934', city: 'Colusa', median: '$410,000', avg: '$435,200', count: 35, priceSqFt: '$245' },
                                            { zip: '95988', city: 'Williams', median: '$365,000', avg: '$389,500', count: 31, priceSqFt: '$212' },
                                        ].map((row, i) => (
                                            <tr key={i} className="hover:bg-secondary/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="font-semibold text-primary">{row.zip}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-secondary">{row.city}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="font-bold text-primary">{row.median}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-secondary">{row.avg}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-secondary">{row.count}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-secondary">{row.priceSqFt}</span>
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
        </MainLayout>
    );
}

