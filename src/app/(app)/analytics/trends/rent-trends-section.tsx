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
    ReferenceLine,
} from "recharts";
import {
    AreaSelection,
    TrendRow,
    BED_KEYS,
    SeriesInfo,
    buildMultiAreaRentData,
    getRentSeriesList,
    formatDollars,
} from "./trends-utils";

interface Props {
    areas: AreaSelection[];
    areaResults: Record<string, TrendRow[]>;
    selectedBeds: number[];
}

type YAxisView = "pct" | "abs";

function buildPctChangeData(
    absData: Array<Record<string, string | number>>,
    series: SeriesInfo[]
): Array<Record<string, string | number>> {
    const baselines: Record<string, number> = {};
    for (const s of series) {
        for (const point of absData) {
            const v = point[s.key];
            if (typeof v === "number") { baselines[s.key] = v; break; }
        }
    }
    return absData.map(point => {
        const out: Record<string, string | number> = { week: point.week, weekLabel: point.weekLabel };
        for (const s of series) {
            const v = point[s.key];
            const base = baselines[s.key];
            if (typeof v === "number" && base != null && base !== 0) {
                out[s.key] = parseFloat((((v - base) / base) * 100).toFixed(2));
            }
        }
        return out;
    });
}

export function RentTrendsSection({ areas, areaResults, selectedBeds }: Props) {
    const [yView, setYView] = useState<YAxisView>("pct");

    const series = getRentSeriesList(areas, selectedBeds);
    const absData = buildMultiAreaRentData(areaResults, areas, selectedBeds);
    const pctData = buildPctChangeData(absData, series);
    const chartData = yView === "pct" ? pctData : absData;
    const onlyOneWeek = chartData.length === 1;

    const bedLabel = selectedBeds.length === 1
        ? (BED_KEYS.find(b => b.beds === selectedBeds[0])?.label ?? "")
        : selectedBeds.map(b => BED_KEYS.find(k => k.beds === b)?.label).join(" vs ");

    const yFormatter = yView === "pct"
        ? (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
        : (v: number) => formatDollars(v);

    const CustomTooltip = ({ active, payload, label }: {
        active?: boolean;
        payload?: Array<{ dataKey: string; name: string; color: string; value: number }>;
        label?: string;
    }) => {
        if (!active || !payload?.length) return null;
        return (
            <div style={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, background: "#fff", padding: "8px 12px" }}>
                <p className="text-gray-500 mb-1">{`Week of ${label}`}</p>
                {payload.map(entry => {
                    const week = chartData.find(p => p.weekLabel === label)?.week as string | undefined;
                    const absPoint = week ? absData.find(p => p.week === week) : undefined;
                    const pctPoint = week ? pctData.find(p => p.week === week) : undefined;
                    const absVal = absPoint?.[entry.dataKey] as number | undefined;
                    const pctVal = pctPoint?.[entry.dataKey] as number | undefined;
                    return (
                        <div key={entry.dataKey} className="flex items-center gap-2">
                            <span style={{ color: entry.color, fontWeight: 600 }}>{entry.name}</span>
                            {absVal != null && <span>{formatDollars(absVal)}</span>}
                            {pctVal != null && (
                                <span className={pctVal >= 0 ? "text-green-600" : "text-red-500"}>
                                    ({pctVal >= 0 ? "+" : ""}{pctVal.toFixed(2)}%)
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Median Rent — {bedLabel}</h2>
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
                        >%</button>
                        <button
                            onClick={() => setYView("abs")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                yView === "abs"
                                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >$</button>
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
                    <Tooltip content={<CustomTooltip />} />

                    {yView === "pct" && <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />}
                    {series.map(s => (
                        <Line
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.label}
                            stroke={s.color}
                            strokeWidth={2}
                            strokeDasharray={s.dash || undefined}
                            dot={onlyOneWeek ? { r: 5, fill: s.color } : { r: 3 }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
