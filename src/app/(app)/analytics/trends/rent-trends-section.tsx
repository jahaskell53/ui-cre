"use client";

import { useState } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from "recharts";
import { AreaSelection, TrendRow, BED_KEYS, buildMultiAreaRentData, formatDollars } from "./trends-utils";

interface Props {
    areas: AreaSelection[];
    areaResults: Record<string, TrendRow[]>;
    selectedBeds: number;
}

type YAxisView = "pct" | "abs";

function buildPctChangeData(
    absData: Array<Record<string, string | number>>,
    areas: AreaSelection[]
): Array<Record<string, string | number>> {
    // Find the first non-null value per area to use as baseline
    const baselines: Record<string, number> = {};
    for (const area of areas) {
        for (const point of absData) {
            const v = point[area.id];
            if (typeof v === "number") {
                baselines[area.id] = v;
                break;
            }
        }
    }

    return absData.map(point => {
        const out: Record<string, string | number> = { week: point.week, weekLabel: point.weekLabel };
        for (const area of areas) {
            const v = point[area.id];
            const base = baselines[area.id];
            if (typeof v === "number" && base != null && base !== 0) {
                out[area.id] = parseFloat((((v - base) / base) * 100).toFixed(2));
            }
        }
        return out;
    });
}

export function RentTrendsSection({ areas, areaResults, selectedBeds }: Props) {
    const [yView, setYView] = useState<YAxisView>("pct");

    const bed = BED_KEYS.find(b => b.beds === selectedBeds)!;
    const absData = buildMultiAreaRentData(areaResults, areas, selectedBeds);
    const pctData = buildPctChangeData(absData, areas);

    const chartData = yView === "pct" ? pctData : absData;
    const onlyOneWeek = chartData.length === 1;

    const yFormatter = yView === "pct"
        ? (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
        : (v: number) => formatDollars(v);

    const tooltipFormatter = yView === "pct"
        ? (value: unknown, name: string) => [`${(value as number) >= 0 ? "+" : ""}${(value as number).toFixed(2)}%`, name ?? ""]
        : (value: unknown, name: string) => [formatDollars(value as number), name ?? ""];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Median Rent — {bed.label}</h2>
                <div className="flex items-center gap-2">
                    {onlyOneWeek && (
                        <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
                            More data coming as scrapes accumulate
                        </span>
                    )}
                    <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                        <button
                            onClick={() => setYView("pct")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                yView === "pct"
                                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >
                            % Change
                        </button>
                        <button
                            onClick={() => setYView("abs")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                yView === "abs"
                                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >
                            $ Rent
                        </button>
                    </div>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis
                        tickFormatter={yFormatter}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        width={yView === "pct" ? 55 : 75}
                    />
                    <Tooltip
                        formatter={tooltipFormatter}
                        labelFormatter={(label) => `Week of ${label}`}
                        contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    />
                    {areas.length > 1 && <Legend />}
                    {yView === "pct" && <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />}
                    {areas.map(area => (
                        <Line
                            key={area.id}
                            type="monotone"
                            dataKey={area.id}
                            name={area.label}
                            stroke={area.color}
                            strokeWidth={2}
                            dot={onlyOneWeek ? { r: 5, fill: area.color } : { r: 3 }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
