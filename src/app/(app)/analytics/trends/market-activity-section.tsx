"use client";

import React, { useState } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { AreaSelection, ActivityRow, BED_KEYS, buildActivityComboData } from "./trends-utils";

interface Props {
    areas: AreaSelection[];
    areaResults: Record<string, ActivityRow[]>;
    selectedBeds: number;
}

type View = "inventory" | "velocity";

export function MarketActivitySection({ areas, areaResults, selectedBeds }: Props) {
    const [view, setView] = useState<View>("inventory");
    const bed = BED_KEYS.find(b => b.beds === selectedBeds)!;
    const chartData = buildActivityComboData(areaResults, areas, selectedBeds);
    const weekCount = chartData.length;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    {view === "inventory" ? "Inventory" : "Velocity"} — {bed.label}
                </h2>
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                    <button
                        onClick={() => setView("inventory")}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            view === "inventory"
                                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                    >
                        Inventory
                    </button>
                    <button
                        onClick={() => setView("velocity")}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            view === "velocity"
                                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                    >
                        Velocity
                    </button>
                </div>
            </div>

            {view === "inventory" ? (
                <>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                            <Tooltip
                                formatter={(value: unknown, name) => [value as number, name ?? ""]}
                                labelFormatter={(label) => `Week of ${label}`}
                                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                            />
                            {areas.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                            {areas.map(area => {
                                const label = areas.length > 1 ? `${area.label} Inventory` : "Active Listings";
                                return (
                                    <Line
                                        key={area.id}
                                        type="monotone"
                                        dataKey={`${area.id}_acc`}
                                        name={label}
                                        stroke={area.color}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                    <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                        Total active listings per week. Rising inventory signals potential downward rent pressure.
                    </p>
                </>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} width={40} />
                            <Tooltip
                                formatter={(value: unknown, name) => [value as number, name ?? ""]}
                                labelFormatter={(label) => `Week of ${label}`}
                                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {areas.map(area => {
                                const prefix = areas.length > 1 ? `${area.label} ` : "";
                                return (
                                    <React.Fragment key={area.id}>
                                        <Line
                                            type="monotone"
                                            dataKey={`${area.id}_new`}
                                            name={`${prefix}New`}
                                            stroke={area.color}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey={`${area.id}_closed`}
                                            name={`${prefix}Closed`}
                                            stroke={area.color}
                                            strokeWidth={2}
                                            strokeDasharray="4 3"
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </React.Fragment>
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                    <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                        New vs. closed listings per week. More new than closed = inventory building up.
                    </p>
                </>
            )}

            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Currently showing {weekCount} week{weekCount !== 1 ? "s" : ""} of data.
            </p>
        </div>
    );
}
