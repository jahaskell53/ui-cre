"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AreaSelection, SalesGranularity, SalesTrendRow, buildMultiAreaSalesData, capRateAbsoluteYAxisConfig, formatMillions, pctChange } from "./trends-utils";

interface Props {
    areas: AreaSelection[];
    areaResults: Record<string, SalesTrendRow[]>;
    salesSource?: "loopnet" | "crexi";
    granularity?: SalesGranularity;
}

type Metric = "median_price" | "avg_cap_rate" | "listing_count";
type YAxisView = "pct" | "abs";

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
    { value: "median_price", label: "Median Price" },
    { value: "avg_cap_rate", label: "Cap Rate" },
    { value: "listing_count", label: "Volume" },
];

function formatYAxis(metric: Metric, view: YAxisView) {
    return (v: number) => {
        if (view === "pct") return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
        if (metric === "median_price") return formatMillions(v);
        if (metric === "avg_cap_rate") return `${v.toFixed(1)}%`;
        return v.toLocaleString();
    };
}

function formatTooltipValue(metric: Metric, v: number): string {
    if (metric === "median_price") return formatMillions(v);
    if (metric === "avg_cap_rate") return `${v.toFixed(2)}%`;
    return v.toLocaleString();
}

function buildPctData(absData: Array<Record<string, string | number>>, areas: AreaSelection[]): Array<Record<string, string | number>> {
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
    return absData.map((point) => {
        const out: Record<string, string | number> = { month: point.month, monthLabel: point.monthLabel };
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

const GRANULARITY_OPTIONS: { value: SalesGranularity; label: string }[] = [
    { value: "month", label: "Monthly" },
    { value: "year", label: "Yearly" },
];

export function SalesTrendsSection({
    areas,
    areaResults,
    salesSource = "crexi",
    granularity = "year",
    onGranularityChange,
}: Props & { onGranularityChange?: (g: SalesGranularity) => void }) {
    const [metric, setMetric] = useState<Metric>("median_price");
    const [yView, setYView] = useState<YAxisView>("pct");

    const absData = useMemo(() => buildMultiAreaSalesData(areaResults, areas, metric, granularity), [areaResults, areas, metric, granularity]);
    const pctData = useMemo(() => buildPctData(absData, areas), [absData, areas]);
    const chartData = yView === "pct" ? pctData : absData;

    const onlyOnePoint = chartData.length === 1;
    const yFormatter = formatYAxis(metric, yView);
    const yWidth = metric === "median_price" ? 75 : metric === "avg_cap_rate" ? 60 : 55;

    const capRateAbsAxis =
        metric === "avg_cap_rate" && yView === "abs"
            ? capRateAbsoluteYAxisConfig(
                  absData,
                  areas.map((a) => a.id),
              )
            : null;

    const CustomTooltip = ({
        active,
        payload,
        label,
    }: {
        active?: boolean;
        payload?: Array<{ dataKey: string; name: string; color: string; value: number }>;
        label?: string;
    }) => {
        if (!active || !payload?.length) return null;
        const month = chartData.find((p) => p.monthLabel === label)?.month as string | undefined;
        const absPoint = month ? absData.find((p) => p.month === month) : undefined;
        const pctPoint = month ? pctData.find((p) => p.month === month) : undefined;
        return (
            <div style={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, background: "#fff", padding: "8px 12px" }}>
                <p className="mb-1 text-gray-500">{label}</p>
                {payload.map((entry) => {
                    const absVal = absPoint?.[entry.dataKey] as number | undefined;
                    const pctVal = pctPoint?.[entry.dataKey] as number | undefined;
                    return (
                        <div key={entry.dataKey} className="flex items-center gap-2">
                            <span style={{ color: entry.color, fontWeight: 600 }}>{entry.name}</span>
                            {yView === "abs" && absVal != null && <span>{formatTooltipValue(metric, absVal)}</span>}
                            {yView === "pct" && pctVal != null && (
                                <span className={pctVal >= 0 ? "text-green-600" : "text-red-500"}>
                                    {pctVal >= 0 ? "+" : ""}
                                    {pctVal.toFixed(2)}%
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="h-full rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                        {METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? "Sales"} —{" "}
                        {salesSource === "crexi" ? "Closed Sales (Crexi)" : "For-Sale Listings (LoopNet)"}
                    </h2>
                    {onlyOnePoint && (
                        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-400 dark:border-gray-600 dark:bg-gray-700">
                            More data as scrapes accumulate
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                        {GRANULARITY_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => onGranularityChange?.(opt.value)}
                                className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                                    granularity === opt.value
                                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                        {METRIC_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setMetric(opt.value)}
                                className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                                    metric === opt.value
                                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {metric !== "listing_count" && (
                        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                            <button
                                onClick={() => setYView("pct")}
                                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                    yView === "pct"
                                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                }`}
                            >
                                {metric === "avg_cap_rate" ? "Δ%" : "%"}
                            </button>
                            <button
                                onClick={() => setYView("abs")}
                                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                    yView === "abs"
                                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                }`}
                            >
                                {metric === "avg_cap_rate" ? "%" : "$"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis
                        tickFormatter={yFormatter}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        width={yWidth}
                        domain={capRateAbsAxis ? capRateAbsAxis.domain : undefined}
                        ticks={capRateAbsAxis ? capRateAbsAxis.ticks : undefined}
                        allowDataOverflow={!!capRateAbsAxis}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {yView === "pct" && <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />}
                    {areas.map((area) => (
                        <Line
                            key={area.id}
                            type="monotone"
                            dataKey={area.id}
                            name={area.label}
                            stroke={area.color}
                            strokeWidth={2}
                            dot={onlyOnePoint ? { r: 5, fill: area.color } : { r: 3 }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>

            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                {salesSource === "crexi" ? (
                    <>
                        {metric === "median_price" &&
                            `Median closed-sale price from Crexi API comps, bucketed by ${granularity === "year" ? "year" : "transaction month"}.`}
                        {metric === "avg_cap_rate" &&
                            "Average cap rate from Crexi comps (sale_cap_rate_percent, falling back to financials_cap_rate_percent). Sparse — many periods will show no value."}
                        {metric === "listing_count" && `Number of Crexi closed sales per ${granularity === "year" ? "year" : "month"}.`}
                    </>
                ) : (
                    <>
                        {metric === "median_price" &&
                            `Median asking price of for-sale commercial listings from LoopNet, bucketed by ${granularity === "year" ? "year" : "month"}.`}
                        {metric === "avg_cap_rate" &&
                            `Average cap rate of for-sale listings where cap rate is available, bucketed by ${granularity === "year" ? "year" : "month"}.`}
                        {metric === "listing_count" && `Number of for-sale listings scraped per ${granularity === "year" ? "year" : "month"}.`}
                    </>
                )}
            </p>
        </div>
    );
}

export function SalesStatsTile({ areas, areaResults, salesSource = "crexi", granularity = "year" }: Props) {
    return (
        <div className="col-span-1 flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            {areas.map((area) => {
                const rows = (areaResults[area.id] ?? []).sort((a, b) => a.month_start.localeCompare(b.month_start));
                const latest = rows.length > 0 ? rows[rows.length - 1] : undefined;
                const first = rows.length > 0 ? rows[0] : undefined;
                const priceChange = pctChange(first?.median_price, latest?.median_price);
                return (
                    <div key={area.id}>
                        <div className="mb-2 flex items-center gap-1.5">
                            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
                            <span className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{area.label}</span>
                        </div>
                        <div className="space-y-2">
                            {latest?.median_price != null ? (
                                <>
                                    <div>
                                        <p className="text-lg font-semibold" style={{ color: area.color }}>
                                            {formatMillions(latest.median_price)}
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-400">{salesSource === "crexi" ? "median sale price" : "median asking price"}</p>
                                        {priceChange != null && (
                                            <p className={`mt-0.5 text-xs font-medium ${priceChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                {priceChange >= 0 ? "+" : ""}
                                                {priceChange.toFixed(1)}% over period
                                            </p>
                                        )}
                                    </div>
                                    {latest.avg_cap_rate != null && (
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{Number(latest.avg_cap_rate).toFixed(2)}%</p>
                                            <p className="mt-0.5 text-xs text-gray-400">avg cap rate</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{latest.listing_count}</p>
                                        <p className="mt-0.5 text-xs text-gray-400">
                                            {salesSource === "crexi"
                                                ? granularity === "year"
                                                    ? "sales this year"
                                                    : "sales this month"
                                                : granularity === "year"
                                                  ? "listings this year"
                                                  : "listings this month"}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <p className="text-lg font-semibold text-gray-400">—</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
