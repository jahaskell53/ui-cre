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
import { ActivityRow, BED_KEYS, buildActivityChartData } from "./trends-utils";

interface Props {
    activityData: ActivityRow[];
}

type ActivityView = 'new_listings' | 'accumulated_listings' | 'closed_listings';

export function MarketActivitySection({ activityData }: Props) {
    const [activityView, setActivityView] = useState<ActivityView>('new_listings');

    const activityChartData = buildActivityChartData(activityData, activityView);
    const weekCount = activityChartData.length;

    const latestWeek = activityData.reduce((max, r) => r.week_start > max ? r.week_start : max, activityData[0].week_start);
    const activityCards = BED_KEYS.map(({ beds, key, label, color }) => {
        const row = activityData.find(r => r.week_start === latestWeek && r.beds === beds);
        return { key, label, color, row };
    });

    const toggleBtn = (view: ActivityView, label: string) => (
        <button
            type="button"
            onClick={() => setActivityView(view)}
            className={`px-3 py-1.5 transition-colors border-l border-gray-200 dark:border-gray-600 first:border-l-0 ${
                activityView === view
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
        >
            {label}
        </button>
    );

    return (
        <>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Market Activity</h2>
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
                        {toggleBtn('new_listings', 'New Listings')}
                        {toggleBtn('accumulated_listings', 'Accumulated')}
                        {toggleBtn('closed_listings', 'Closed')}
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={activityChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="weekLabel"
                            tick={{ fontSize: 12, fill: "#6b7280" }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: "#6b7280" }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                        />
                        <Tooltip
                            formatter={(value: unknown, name: unknown) => [value as number, name as string]}
                            labelFormatter={(label) => `Week of ${label}`}
                            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                        />
                        <Legend
                            formatter={(value) => (
                                <span style={{ fontSize: 12, color: "#374151" }}>{value}</span>
                            )}
                        />
                        {BED_KEYS.map(({ key, label, color }) => (
                            <Bar key={key} dataKey={key} name={label} fill={color} radius={[3, 3, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    Days-to-rent granularity improves with each weekly scrape. Currently showing {weekCount} week{weekCount !== 1 ? 's' : ''} of data.
                </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {activityCards.map(({ key, label, color, row }) => (
                    <div
                        key={key}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                    >
                        <div className="flex items-center gap-1.5 mb-3">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                        </div>
                        {row ? (
                            <div className="space-y-2">
                                <div>
                                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{row.accumulated_listings.toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">accumulated listings</p>
                                </div>
                                <div className="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-1">
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        <span className="font-medium">{row.new_listings.toLocaleString()}</span>
                                        <span className="text-gray-400"> new last week</span>
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        <span className="font-medium">{row.closed_listings.toLocaleString()}</span>
                                        <span className="text-gray-400"> closed last week</span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xl font-semibold text-gray-400">—</p>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}
