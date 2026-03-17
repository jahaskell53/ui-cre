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
    Legend,
} from "recharts";
import { BED_KEYS, ChartPoint, formatDollars, pctChange } from "./trends-utils";

interface Props {
    chartData: ChartPoint[];
}

export function RentTrendsSection({ chartData }: Props) {
    const onlyOneWeek = chartData.length === 1;

    const summaryCards = BED_KEYS.map(({ key, label, color }) => {
        const weeks = chartData.filter(p => p[key] != null);
        const latest = weeks.length > 0 ? weeks[weeks.length - 1][key] : undefined;
        const first = weeks.length > 0 ? weeks[0][key] : undefined;
        const change = weeks.length >= 2 ? pctChange(first, latest) : null;
        return { key, label, color, latest, change };
    });

    return (
        <>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Median Rent by Bedroom Type</h2>
                    {onlyOneWeek && (
                        <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
                            More data coming as scrapes accumulate
                        </span>
                    )}
                </div>
                <ResponsiveContainer width="100%" height={320}>
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
                            formatter={(value: any, name: any) => [formatDollars(value as number), name as string]}
                            labelFormatter={(label) => `Week of ${label}`}
                            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                        />
                        <Legend
                            formatter={(value) => (
                                <span style={{ fontSize: 12, color: "#374151" }}>{value}</span>
                            )}
                        />
                        {BED_KEYS.map(({ key, label, color }) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                name={label}
                                stroke={color}
                                strokeWidth={2}
                                dot={onlyOneWeek ? { r: 5, fill: color } : { r: 3 }}
                                activeDot={{ r: 5 }}
                                connectNulls={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {summaryCards.map(({ key, label, color, latest, change }) => (
                    <div
                        key={key}
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
                    >
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                        </div>
                        {latest != null ? (
                            <>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                    {formatDollars(latest)}
                                </p>
                                {change != null ? (
                                    <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {change >= 0
                                            ? <ArrowUpRight className="size-3.5" />
                                            : <ArrowDownRight className="size-3.5" />}
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
                ))}
            </div>
        </>
    );
}
