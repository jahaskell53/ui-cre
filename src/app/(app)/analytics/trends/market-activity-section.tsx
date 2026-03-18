"use client";

import React from "react";
import { useState } from "react";
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { AreaSelection, ActivityRow, BED_KEYS, buildActivityComboData } from "./trends-utils";

interface Props {
    areas: AreaSelection[];
    areaResults: Record<string, ActivityRow[]>;
    selectedBeds: number;
}

// Lighten a hex color by mixing with white at a given opacity
function withOpacity(hex: string, opacity: number) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
}

export function MarketActivitySection({ areas, areaResults, selectedBeds }: Props) {
    const bed = BED_KEYS.find(b => b.beds === selectedBeds)!;
    const chartData = buildActivityComboData(areaResults, areas, selectedBeds);
    const weekCount = chartData.length;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Market Activity — {bed.label}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#6b7280" }} />New</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm opacity-40" style={{ backgroundColor: "#6b7280" }} />Closed</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-gray-400" />Inventory</span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip
                        formatter={(value: unknown, name) => [value as number, name ?? ""]}
                        labelFormatter={(label) => `Week of ${label}`}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    />
                    {areas.map(area => {
                        const prefix = areas.length > 1 ? `${area.label} ` : "";
                        return (
                            <React.Fragment key={area.zip}>
                                <Bar key={`${area.zip}_new`} yAxisId="left" dataKey={`${area.zip}_new`} name={`${prefix}New`} stackId={area.zip} fill={area.color} radius={[0, 0, 0, 0]} />
                                <Bar yAxisId="left" dataKey={`${area.zip}_closed`} name={`${prefix}Closed`} stackId={area.zip} fill={withOpacity(area.color, 0.35)} radius={[3, 3, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey={`${area.zip}_acc`} name={`${prefix}Inventory`} stroke={area.color} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />
                            </React.Fragment>
                        );
                    })}
                </ComposedChart>
            </ResponsiveContainer>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                Currently showing {weekCount} week{weekCount !== 1 ? 's' : ''} of data.
            </p>
        </div>
    );
}
