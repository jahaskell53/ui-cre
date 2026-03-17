"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { BED_KEYS, ChartPoint, formatDollars, pctChange } from "./trends-utils";

interface Props {
    chartData: ChartPoint[];
    selectedBeds: number;
}

export function RentTrendsSection({ chartData, selectedBeds }: Props) {
    const onlyOneWeek = chartData.length === 1;
    const bed = BED_KEYS.find(b => b.beds === selectedBeds)!;

    const weeks = chartData.filter(p => p[bed.key] != null);
    const latest = weeks.length > 0 ? weeks[weeks.length - 1][bed.key] : undefined;
    const first = weeks.length > 0 ? weeks[0][bed.key] : undefined;
    const change = weeks.length >= 2 ? pctChange(first, latest) : null;

    return (
        <>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-8">
                <div className="flex items-center gap-1.5 mb-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: bed.color }} />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{bed.label}</span>
                </div>
                {latest != null ? (
                    <>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                            {formatDollars(latest)}
                        </p>
                        {change != null ? (
                            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                                {Math.abs(change).toFixed(1)}% week-over-week
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 mt-1">— not enough data</p>
                        )}
                    </>
                ) : (
                    <p className="text-2xl font-semibold text-gray-400">—</p>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Median Rent — {bed.label}</h2>
                    {onlyOneWeek && (
                        <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
                            More data coming as scrapes accumulate
                        </span>
                    )}
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="weekLabel"
                            tick={{ fontSize: 12, fill: "#6b7280" }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={(v) => formatDollars(v)}
                            tick={{ fontSize: 12, fill: "#6b7280" }}
                            axisLine={false}
                            tickLine={false}
                            width={75}
                        />
                        <Tooltip
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any) => [formatDollars(value as number), bed.label]}
                            labelFormatter={(label) => `Week of ${label}`}
                            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                        />
                        <Line
                            type="monotone"
                            dataKey={bed.key}
                            stroke={bed.color}
                            strokeWidth={2}
                            dot={onlyOneWeek ? { r: 5, fill: bed.color } : { r: 3 }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </>
    );
}
