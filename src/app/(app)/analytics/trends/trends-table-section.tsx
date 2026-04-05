"use client";

import { ActivityRow, AreaSelection, TrendRow, formatDollars, formatWeekLabel } from "./trends-utils";

interface TrendsTableSectionProps {
    areas: AreaSelection[];
    rentResults: Record<string, TrendRow[]>;
    activityResults: Record<string, ActivityRow[]>;
    selectedBeds: number;
}

export function TrendsTableSection({ areas, rentResults, activityResults, selectedBeds }: TrendsTableSectionProps) {
    return (
        <div className="space-y-6">
            {areas.map((area) => {
                const rentByWeek: Record<string, TrendRow> = {};
                (rentResults[area.id] ?? [])
                    .filter((r) => r.beds === selectedBeds)
                    .forEach((r) => {
                        rentByWeek[r.week_start] = r;
                    });

                const activityByWeek: Record<string, ActivityRow> = {};
                (activityResults[area.id] ?? [])
                    .filter((r) => r.beds === selectedBeds)
                    .forEach((r) => {
                        activityByWeek[r.week_start] = r;
                    });

                const allWeeks = Array.from(new Set([...Object.keys(rentByWeek), ...Object.keys(activityByWeek)])).sort((a, b) => b.localeCompare(a));

                if (allWeeks.length === 0) {
                    return (
                        <div key={area.id} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{area.label}</span>
                            </div>
                            <p className="text-sm text-gray-400">No data available</p>
                        </div>
                    );
                }

                return (
                    <div key={area.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{area.label}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/40">
                                        <th className="px-5 py-2.5 text-left font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">Week</th>
                                        <th className="px-5 py-2.5 text-right font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">Median Rent</th>
                                        <th className="px-5 py-2.5 text-right font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">WoW $</th>
                                        <th className="px-5 py-2.5 text-right font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">WoW %</th>
                                        <th className="px-5 py-2.5 text-right font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">Inventory</th>
                                        <th className="px-5 py-2.5 text-right font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">New Listings</th>
                                        <th className="px-5 py-2.5 text-right font-medium whitespace-nowrap text-gray-500 dark:text-gray-400">
                                            Closed Listings
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {allWeeks.map((week, i) => {
                                        const rentRow = rentByWeek[week];
                                        const actRow = activityByWeek[week];
                                        const prevWeek = allWeeks[i + 1];
                                        const prevRentRow = prevWeek ? rentByWeek[prevWeek] : undefined;
                                        const dollarChange =
                                            rentRow && prevRentRow ? Math.round(rentRow.median_rent) - Math.round(prevRentRow.median_rent) : null;
                                        const pctChange =
                                            dollarChange != null && prevRentRow && prevRentRow.median_rent !== 0
                                                ? (dollarChange / prevRentRow.median_rent) * 100
                                                : null;
                                        const changeColor =
                                            dollarChange == null
                                                ? ""
                                                : dollarChange > 0
                                                  ? "text-green-600 dark:text-green-400"
                                                  : dollarChange < 0
                                                    ? "text-red-600 dark:text-red-400"
                                                    : "text-gray-500";
                                        return (
                                            <tr key={week} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40">
                                                <td className="px-5 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-400">{formatWeekLabel(week)}</td>
                                                <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                                                    {rentRow ? formatDollars(Math.round(rentRow.median_rent)) : "—"}
                                                </td>
                                                <td className={`px-5 py-2.5 text-right whitespace-nowrap ${changeColor}`}>
                                                    {dollarChange == null ? "—" : `${dollarChange >= 0 ? "+" : ""}${formatDollars(dollarChange)}`}
                                                </td>
                                                <td className={`px-5 py-2.5 text-right whitespace-nowrap ${changeColor}`}>
                                                    {pctChange == null ? "—" : `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}%`}
                                                </td>
                                                <td className="px-5 py-2.5 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                    {actRow ? actRow.accumulated_listings.toLocaleString() : "—"}
                                                </td>
                                                <td className="px-5 py-2.5 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                    {actRow ? actRow.new_listings.toLocaleString() : "—"}
                                                </td>
                                                <td className="px-5 py-2.5 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
                                                    {actRow ? actRow.closed_listings.toLocaleString() : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
