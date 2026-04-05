"use client";

import React, { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ActivityRow, AreaSelection, BED_KEYS, buildActivityComboData, getActivitySeriesList } from "./trends-utils";

interface Props {
    areas: AreaSelection[];
    areaResults: Record<string, ActivityRow[]>;
    selectedBeds: number[];
}

type View = "inventory" | "velocity";

export function MarketActivitySection({ areas, areaResults, selectedBeds }: Props) {
    const [view, setView] = useState<View>("inventory");

    const bedLabel =
        selectedBeds.length === 1
            ? (BED_KEYS.find((b) => b.beds === selectedBeds[0])?.label ?? "")
            : selectedBeds.map((b) => BED_KEYS.find((k) => k.beds === b)?.label).join(" vs ");

    const series = getActivitySeriesList(areas, selectedBeds);
    const chartData = buildActivityComboData(areaResults, areas, selectedBeds);
    const weekCount = chartData.length;

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    {view === "inventory" ? "Inventory" : "Velocity"} — {bedLabel}
                </h2>
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                    <button
                        onClick={() => setView("inventory")}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                            view === "inventory"
                                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        }`}
                    >
                        Inventory
                    </button>
                    <button
                        onClick={() => setView("velocity")}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                            view === "velocity"
                                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
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
                            {series.map((s) => (
                                <Line
                                    key={s.key}
                                    type="monotone"
                                    dataKey={`${s.key}_acc`}
                                    name={series.length > 1 ? `${s.label} Inventory` : "Active Listings"}
                                    stroke={s.color}
                                    strokeWidth={2}
                                    strokeDasharray={s.dash || undefined}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            ))}
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
                            {series.map((s) => {
                                const prefix = series.length > 1 ? `${s.label} ` : "";
                                return (
                                    <React.Fragment key={s.key}>
                                        <Line
                                            type="monotone"
                                            dataKey={`${s.key}_new`}
                                            name={`${prefix}New`}
                                            stroke={s.color}
                                            strokeWidth={2}
                                            strokeDasharray={s.dash || undefined}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey={`${s.key}_closed`}
                                            name={`${prefix}Closed`}
                                            stroke={s.color}
                                            strokeWidth={2}
                                            strokeDasharray={s.dash ? `${s.dash}` : "4 3"}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </React.Fragment>
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <svg width="24" height="4" viewBox="0 0 24 4" className="shrink-0">
                                <line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            New
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <svg width="24" height="4" viewBox="0 0 24 4" className="shrink-0">
                                <line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
                            </svg>
                            Closed
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
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
