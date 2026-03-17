"use client";

import { useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { AreaSelection, ActivityRow, BED_KEYS, buildMultiAreaActivityData } from "./trends-utils";

interface Props {
    areas: AreaSelection[];
    areaResults: Record<string, ActivityRow[]>;
    selectedBeds: number;
}

type ActivityView = 'new_listings' | 'accumulated_listings' | 'closed_listings';

export function MarketActivitySection({ areas, areaResults, selectedBeds }: Props) {
    const [activityView, setActivityView] = useState<ActivityView>('new_listings');

    const bed = BED_KEYS.find(b => b.beds === selectedBeds)!;
    const chartData = buildMultiAreaActivityData(areaResults, areas, selectedBeds, activityView);
    const weekCount = chartData.length;

    const toggleBtn = (view: ActivityView, label: string, first = false) => (
        <button
            type="button"
            onClick={() => setActivityView(view)}
            className={`px-3 py-1.5 transition-colors text-sm ${first ? '' : 'border-l border-gray-200 dark:border-gray-600'} ${
                activityView === view
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Market Activity — {bed.label}</h2>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                    {toggleBtn('new_listings', 'New Listings', true)}
                    {toggleBtn('accumulated_listings', 'Accumulated')}
                    {toggleBtn('closed_listings', 'Closed')}
                </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                        formatter={(value: unknown, name) => [value as number, name ?? ""]}
                        labelFormatter={(label) => `Week of ${label}`}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    />
                    {areas.length > 1 && <Legend />}
                    {areas.map(area => (
                        <Bar key={area.zip} dataKey={area.zip} name={area.label} fill={area.color} radius={[3, 3, 0, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                Days-to-rent granularity improves with each weekly scrape. Currently showing {weekCount} week{weekCount !== 1 ? 's' : ''} of data.
            </p>
        </div>
    );
}
