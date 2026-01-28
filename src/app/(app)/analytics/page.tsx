"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Building2, MapPin, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface SubmarketData {
    name: string;
    capRate: number;
    vacancy: number;
    rentGrowth: number;
    avgRent: number;
    inventory: number;
}

interface MarketData {
    capRate: { current: number; trend: number; history: number[] };
    vacancy: { current: number; trend: number; history: number[] };
    rentGrowth: { current: number; trend: number };
    absorption: { current: number; trend: number };
    avgRent: { current: number; trend: number };
    inventory: { current: number; trend: number };
    submarkets: SubmarketData[];
}

// Bay Area submarkets data
const bayAreaData: MarketData = {
    capRate: { current: 4.6, trend: -0.25, history: [5.1, 4.95, 4.85, 4.75, 4.68, 4.6] },
    vacancy: { current: 5.2, trend: 0.5, history: [4.2, 4.5, 4.7, 4.9, 5.0, 5.2] },
    rentGrowth: { current: 2.1, trend: -1.4 },
    absorption: { current: 1842, trend: -8.3 },
    avgRent: { current: 2890, trend: 1.8 },
    inventory: { current: 245800, trend: 1.4 },
    submarkets: [
        { name: "San Francisco", capRate: 4.3, vacancy: 6.1, rentGrowth: 1.2, avgRent: 3450, inventory: 68200 },
        { name: "Oakland", capRate: 4.8, vacancy: 4.8, rentGrowth: 2.8, avgRent: 2680, inventory: 42100 },
        { name: "San Jose", capRate: 4.5, vacancy: 4.2, rentGrowth: 2.4, avgRent: 3120, inventory: 52400 },
        { name: "Fremont", capRate: 4.6, vacancy: 3.9, rentGrowth: 2.9, avgRent: 2890, inventory: 18600 },
        { name: "Walnut Creek", capRate: 4.9, vacancy: 4.5, rentGrowth: 2.2, avgRent: 2750, inventory: 12400 },
        { name: "Palo Alto", capRate: 4.1, vacancy: 3.8, rentGrowth: 1.8, avgRent: 3680, inventory: 8900 },
        { name: "Berkeley", capRate: 4.7, vacancy: 5.4, rentGrowth: 1.5, avgRent: 2920, inventory: 15800 },
        { name: "Mountain View", capRate: 4.2, vacancy: 4.1, rentGrowth: 2.1, avgRent: 3380, inventory: 11200 },
    ],
};

// US Regional data
const usRegionData: Record<string, MarketData> = {
    "west": {
        capRate: { current: 5.2, trend: -0.3, history: [5.8, 5.6, 5.5, 5.4, 5.3, 5.2] },
        vacancy: { current: 4.8, trend: 0.4, history: [3.9, 4.1, 4.3, 4.5, 4.6, 4.8] },
        rentGrowth: { current: 3.2, trend: -1.1 },
        absorption: { current: 12847, trend: 12.3 },
        avgRent: { current: 2450, trend: 2.8 },
        inventory: { current: 892400, trend: 1.2 },
        submarkets: [
            { name: "Los Angeles", capRate: 4.9, vacancy: 4.2, rentGrowth: 2.8, avgRent: 2680, inventory: 245000 },
            { name: "Bay Area", capRate: 4.6, vacancy: 5.2, rentGrowth: 2.1, avgRent: 2890, inventory: 245800 },
            { name: "Seattle", capRate: 5.1, vacancy: 4.9, rentGrowth: 3.4, avgRent: 2180, inventory: 142000 },
            { name: "Phoenix", capRate: 5.4, vacancy: 5.8, rentGrowth: 4.2, avgRent: 1620, inventory: 168000 },
            { name: "Denver", capRate: 5.3, vacancy: 5.2, rentGrowth: 3.1, avgRent: 1850, inventory: 124000 },
            { name: "San Diego", capRate: 4.8, vacancy: 4.0, rentGrowth: 3.0, avgRent: 2420, inventory: 98000 },
        ],
    },
    "southwest": {
        capRate: { current: 5.6, trend: -0.2, history: [6.1, 5.9, 5.8, 5.7, 5.6, 5.6] },
        vacancy: { current: 6.2, trend: 0.8, history: [4.8, 5.2, 5.5, 5.8, 6.0, 6.2] },
        rentGrowth: { current: 4.1, trend: -0.5 },
        absorption: { current: 18920, trend: -5.2 },
        avgRent: { current: 1680, trend: 3.9 },
        inventory: { current: 658200, trend: 2.8 },
        submarkets: [
            { name: "Dallas-Fort Worth", capRate: 5.5, vacancy: 6.1, rentGrowth: 4.3, avgRent: 1580, inventory: 198000 },
            { name: "Austin", capRate: 5.2, vacancy: 7.2, rentGrowth: 3.8, avgRent: 1720, inventory: 124000 },
            { name: "Houston", capRate: 5.8, vacancy: 6.5, rentGrowth: 3.2, avgRent: 1480, inventory: 186000 },
            { name: "San Antonio", capRate: 5.9, vacancy: 5.8, rentGrowth: 4.1, avgRent: 1380, inventory: 82000 },
            { name: "Las Vegas", capRate: 5.4, vacancy: 5.4, rentGrowth: 4.8, avgRent: 1540, inventory: 68000 },
        ],
    },
    "southeast": {
        capRate: { current: 5.4, trend: -0.4, history: [6.0, 5.8, 5.7, 5.5, 5.5, 5.4] },
        vacancy: { current: 5.1, trend: 0.6, history: [4.1, 4.4, 4.6, 4.8, 4.9, 5.1] },
        rentGrowth: { current: 5.2, trend: -0.8 },
        absorption: { current: 22410, trend: 8.7 },
        avgRent: { current: 1820, trend: 4.5 },
        inventory: { current: 812800, trend: 2.1 },
        submarkets: [
            { name: "Miami", capRate: 5.0, vacancy: 4.5, rentGrowth: 5.8, avgRent: 2480, inventory: 142000 },
            { name: "Atlanta", capRate: 5.3, vacancy: 5.2, rentGrowth: 4.9, avgRent: 1680, inventory: 198000 },
            { name: "Tampa", capRate: 5.2, vacancy: 4.8, rentGrowth: 5.4, avgRent: 1920, inventory: 98000 },
            { name: "Orlando", capRate: 5.4, vacancy: 5.0, rentGrowth: 5.1, avgRent: 1780, inventory: 86000 },
            { name: "Charlotte", capRate: 5.4, vacancy: 5.0, rentGrowth: 4.6, avgRent: 1620, inventory: 82000 },
            { name: "Nashville", capRate: 5.1, vacancy: 5.6, rentGrowth: 4.2, avgRent: 1740, inventory: 68000 },
        ],
    },
    "midwest": {
        capRate: { current: 6.1, trend: -0.1, history: [6.4, 6.3, 6.2, 6.2, 6.1, 6.1] },
        vacancy: { current: 5.8, trend: 0.2, history: [5.4, 5.5, 5.5, 5.6, 5.7, 5.8] },
        rentGrowth: { current: 2.8, trend: 0.3 },
        absorption: { current: 8456, trend: 2.1 },
        avgRent: { current: 1420, trend: 2.4 },
        inventory: { current: 498500, trend: 0.8 },
        submarkets: [
            { name: "Chicago", capRate: 5.9, vacancy: 5.4, rentGrowth: 2.6, avgRent: 1680, inventory: 186000 },
            { name: "Minneapolis", capRate: 6.0, vacancy: 5.9, rentGrowth: 2.9, avgRent: 1420, inventory: 72000 },
            { name: "Indianapolis", capRate: 6.2, vacancy: 6.1, rentGrowth: 3.2, avgRent: 1280, inventory: 58000 },
            { name: "Columbus", capRate: 6.0, vacancy: 5.5, rentGrowth: 3.0, avgRent: 1340, inventory: 52000 },
            { name: "Kansas City", capRate: 6.3, vacancy: 5.8, rentGrowth: 2.4, avgRent: 1220, inventory: 48000 },
        ],
    },
    "northeast": {
        capRate: { current: 4.8, trend: -0.2, history: [5.2, 5.1, 5.0, 4.9, 4.9, 4.8] },
        vacancy: { current: 3.9, trend: 0.3, history: [3.4, 3.5, 3.6, 3.7, 3.8, 3.9] },
        rentGrowth: { current: 2.4, trend: -0.4 },
        absorption: { current: 6823, trend: -2.8 },
        avgRent: { current: 2890, trend: 2.1 },
        inventory: { current: 642100, trend: 0.6 },
        submarkets: [
            { name: "New York Metro", capRate: 4.5, vacancy: 3.2, rentGrowth: 2.0, avgRent: 3480, inventory: 286000 },
            { name: "Boston", capRate: 4.7, vacancy: 3.8, rentGrowth: 2.5, avgRent: 3120, inventory: 124000 },
            { name: "Philadelphia", capRate: 5.2, vacancy: 4.5, rentGrowth: 2.8, avgRent: 1820, inventory: 98000 },
            { name: "Washington DC", capRate: 4.9, vacancy: 4.1, rentGrowth: 2.2, avgRent: 2240, inventory: 134000 },
        ],
    },
};

const usRegions = [
    { id: "west", label: "West" },
    { id: "southwest", label: "Southwest" },
    { id: "southeast", label: "Southeast" },
    { id: "midwest", label: "Midwest" },
    { id: "northeast", label: "Northeast" },
];

const timeframes = [
    { id: "6m", label: "6 Months" },
    { id: "1y", label: "1 Year" },
    { id: "3y", label: "3 Years" },
    { id: "5y", label: "5 Years" },
];

const propertyTypes = [
    { id: "all", label: "All Multifamily" },
    { id: "garden", label: "Garden" },
    { id: "midrise", label: "Mid-Rise" },
    { id: "highrise", label: "High-Rise" },
];

function MetricCard({
    label,
    value,
    unit,
    trend,
    trendLabel,
    isPositive,
}: {
    label: string;
    value: string | number;
    unit?: string;
    trend?: number;
    trendLabel?: string;
    isPositive?: boolean;
}) {
    const showTrend = trend !== undefined;
    const trendIsPositive = isPositive !== undefined ? isPositive : (trend !== undefined && trend >= 0);

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {label}
                </p>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
                <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                    {value}
                </h3>
                {unit && (
                    <span className="text-lg font-medium text-gray-400 dark:text-gray-500">
                        {unit}
                    </span>
                )}
            </div>
            {showTrend && (
                <div className={cn(
                    "flex items-center gap-1 text-sm font-medium mt-2",
                    trendIsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                    {trendIsPositive ? (
                        <ArrowUpRight className="size-4" />
                    ) : (
                        <ArrowDownRight className="size-4" />
                    )}
                    <span>{Math.abs(trend).toFixed(1)}%</span>
                    {trendLabel && (
                        <span className="text-gray-400 dark:text-gray-500 ml-1">{trendLabel}</span>
                    )}
                </div>
            )}
        </div>
    );
}

function SparklineChart({
    data,
    color = "#10b981",
    height = 96,
    gradientId,
}: {
    data: number[];
    color?: string;
    height?: number;
    gradientId?: string;
}) {
    const chartData = data.map((value, index) => ({
        month: index,
        value,
    }));

    const uniqueId = gradientId || `gradient-${color.replace('#', '')}-${Math.random().toString(36).substr(2, 9)}`;

    if (!data || data.length === 0) {
        return <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No data</div>;
    }

    // Calculate domain with padding for better visibility
    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const dataRange = maxValue - minValue;
    const padding = dataRange * 0.15 || 0.1; // 15% padding, or 0.1 if range is 0

    return (
        <div className="w-full" style={{ height: `${height}px` }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                    <defs>
                        <linearGradient id={uniqueId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <YAxis hide domain={[minValue - padding, maxValue + padding]} />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#${uniqueId})`}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={true}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

function TrendChart({
    title,
    subtitle,
    data,
    currentValue,
    unit,
    trend,
    isPositive,
    color,
}: {
    title: string;
    subtitle: string;
    data: number[];
    currentValue: number;
    unit: string;
    trend: number;
    isPositive?: boolean;
    color: string;
}) {
    const trendIsPositive = isPositive !== undefined ? isPositive : trend >= 0;
    const gradientId = `gradient-${title.toLowerCase().replace(/\s+/g, '-')}-${color.replace('#', '')}`;

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
                </div>
                <div className="text-right">
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {currentValue.toFixed(1)}
                        </span>
                        <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{unit}</span>
                    </div>
                    <div className={cn(
                        "flex items-center justify-end gap-1 text-sm font-medium mt-1",
                        trendIsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}>
                        {trendIsPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                        <span>{Math.abs(trend).toFixed(0)} bps YoY</span>
                    </div>
                </div>
            </div>
            <div className="h-24 w-full">
                <SparklineChart data={data} color={color} height={96} gradientId={gradientId} />
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <span>6 Mo Ago</span>
                <span>Current</span>
            </div>
        </div>
    );
}

type ViewMode = "bayarea" | "national";

export default function AnalyticsPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("bayarea");
    const [selectedRegion, setSelectedRegion] = useState("west");
    const [selectedTimeframe, setSelectedTimeframe] = useState("1y");
    const [selectedPropertyType, setSelectedPropertyType] = useState("all");

    const data = viewMode === "bayarea" ? bayAreaData : usRegionData[selectedRegion];
    const locationLabel = viewMode === "bayarea" 
        ? "San Francisco Bay Area" 
        : usRegions.find(r => r.id === selectedRegion)?.label + " Region";

    return (
        <div className="flex flex-col h-full overflow-auto bg-gray-50 dark:bg-gray-950">
            <div className="flex flex-col gap-8 p-6 lg:p-8">
                <div className="max-w-7xl mx-auto w-full flex flex-col gap-10">
                    {/* Header */}
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Real-time market intelligence and trend analysis for multifamily markets.
                        </p>
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
                        <button
                            onClick={() => setViewMode("bayarea")}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                                viewMode === "bayarea"
                                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            Bay Area
                        </button>
                        <button
                            onClick={() => setViewMode("national")}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                                viewMode === "national"
                                    ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            National
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
                        {viewMode === "national" && (
                            <div className="w-full sm:w-48 space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                    Region
                                </Label>
                                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                                    <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 h-10 font-medium">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {usRegions.map((region) => (
                                            <SelectItem key={region.id} value={region.id}>
                                                {region.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="w-full sm:w-48 space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                Timeframe
                            </Label>
                            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                                <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 h-10 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeframes.map((tf) => (
                                        <SelectItem key={tf.id} value={tf.id}>
                                            {tf.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-full sm:w-48 space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                Property Type
                            </Label>
                            <Select value={selectedPropertyType} onValueChange={setSelectedPropertyType}>
                                <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 h-10 font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {propertyTypes.map((pt) => (
                                        <SelectItem key={pt.id} value={pt.id}>
                                            {pt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Location Label */}
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                        <div className="flex items-center gap-2 px-4">
                            <MapPin className="size-4 text-gray-400 dark:text-gray-500" />
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                                {locationLabel}
                            </p>
                        </div>
                        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <MetricCard
                            label="Average Cap Rate"
                            value={data.capRate.current.toFixed(1)}
                            unit="%"
                            trend={data.capRate.trend * 100}
                            trendLabel="YoY"
                            isPositive={data.capRate.trend < 0}
                        />
                        <MetricCard
                            label="Vacancy Rate"
                            value={data.vacancy.current.toFixed(1)}
                            unit="%"
                            trend={data.vacancy.trend * 100}
                            trendLabel="YoY"
                            isPositive={data.vacancy.trend < 0}
                        />
                        <MetricCard
                            label="Rent Growth"
                            value={data.rentGrowth.current.toFixed(1)}
                            unit="%"
                            trend={data.rentGrowth.trend * 100}
                            trendLabel="vs Prior"
                            isPositive={data.rentGrowth.trend > 0}
                        />
                        <MetricCard
                            label="Net Absorption"
                            value={data.absorption.current.toLocaleString()}
                            unit="units"
                            trend={data.absorption.trend}
                            trendLabel="YoY"
                            isPositive={data.absorption.trend > 0}
                        />
                        <MetricCard
                            label="Average Rent"
                            value={`$${data.avgRent.current.toLocaleString()}`}
                            trend={data.avgRent.trend}
                            trendLabel="YoY"
                            isPositive={data.avgRent.trend > 0}
                        />
                        <MetricCard
                            label="Total Inventory"
                            value={(data.inventory.current / 1000).toFixed(0)}
                            unit="K units"
                            trend={data.inventory.trend}
                            trendLabel="YoY"
                            isPositive={true}
                        />
                    </div>

                    {/* Trend Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <TrendChart
                            title="Cap Rate Trends"
                            subtitle="6-month trailing average"
                            data={data.capRate.history}
                            currentValue={data.capRate.current}
                            unit="%"
                            trend={data.capRate.trend * 100}
                            isPositive={data.capRate.trend < 0}
                            color="#10b981"
                        />
                        <TrendChart
                            title="Vacancy Trends"
                            subtitle="6-month trailing average"
                            data={data.vacancy.history}
                            currentValue={data.vacancy.current}
                            unit="%"
                            trend={data.vacancy.trend * 100}
                            isPositive={data.vacancy.trend < 0}
                            color="#f59e0b"
                        />
                    </div>

                    {/* Submarket Comparison */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-3">
                                <Building2 className="size-5 text-gray-400 dark:text-gray-500" />
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                        {viewMode === "bayarea" ? "Submarket Comparison" : "Metro Market Comparison"}
                                    </h2>
                                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                                        Key metrics across {viewMode === "bayarea" ? "Bay Area submarkets" : `major markets in the ${usRegions.find(r => r.id === selectedRegion)?.label} region`}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                            {viewMode === "bayarea" ? "Submarket" : "Metro"}
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">
                                            Cap Rate
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">
                                            Vacancy
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">
                                            Rent Growth
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">
                                            Avg Rent
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">
                                            Inventory
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {data.submarkets.map((market, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="px-6 py-5">
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {market.name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-right font-medium text-gray-900 dark:text-gray-100">
                                                {market.capRate.toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-5 text-right font-medium text-gray-900 dark:text-gray-100">
                                                {market.vacancy.toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <span className={cn(
                                                    "font-medium",
                                                    market.rentGrowth >= 0 
                                                        ? "text-emerald-600 dark:text-emerald-400" 
                                                        : "text-red-600 dark:text-red-400"
                                                )}>
                                                    {market.rentGrowth >= 0 ? "+" : ""}{market.rentGrowth.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-right font-medium text-gray-900 dark:text-gray-100">
                                                ${market.avgRent.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-5 text-right text-gray-500 dark:text-gray-400">
                                                {(market.inventory / 1000).toFixed(0)}K
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Regional Comparison Bar Chart - Only show in Bay Area view */}
                    {viewMode === "bayarea" && (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                            <div className="mb-8">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    Submarket Cap Rate Comparison
                                </h2>
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                                    Current cap rates across Bay Area submarkets
                                </p>
                            </div>
                            <div className="space-y-4">
                                {data.submarkets.slice(0, 6).map((market) => {
                                    const maxCapRate = 6;
                                    const percentage = (market.capRate / maxCapRate) * 100;

                                    return (
                                        <div key={market.name} className="group">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    {market.name}
                                                </span>
                                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                                    {market.capRate.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gray-900 dark:bg-gray-100 transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* US Regional Overview - Only show in National view */}
                    {viewMode === "national" && (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                            <div className="mb-8">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    U.S. Regional Cap Rate Overview
                                </h2>
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                                    Average cap rates across all U.S. regions
                                </p>
                            </div>
                            <div className="space-y-4">
                                {usRegions.map((region) => {
                                    const regionCapRate = usRegionData[region.id].capRate.current;
                                    const maxCapRate = 7;
                                    const percentage = (regionCapRate / maxCapRate) * 100;
                                    const isSelected = region.id === selectedRegion;

                                    return (
                                        <button
                                            key={region.id}
                                            onClick={() => setSelectedRegion(region.id)}
                                            className="w-full text-left group"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={cn(
                                                    "text-sm font-medium transition-colors",
                                                    isSelected 
                                                        ? "text-gray-900 dark:text-gray-100" 
                                                        : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                                                )}>
                                                    {region.label}
                                                </span>
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    isSelected 
                                                        ? "text-gray-900 dark:text-gray-100" 
                                                        : "text-gray-500 dark:text-gray-400"
                                                )}>
                                                    {regionCapRate.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-500",
                                                        isSelected 
                                                            ? "bg-gray-900 dark:bg-gray-100" 
                                                            : "bg-gray-300 dark:bg-gray-600 group-hover:bg-gray-400 dark:group-hover:bg-gray-500"
                                                    )}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Footer Note */}
                    <div className="text-center py-4">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            Data is for demonstration purposes. Market intelligence updated quarterly.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
