"use client";

import { TrendRow, ActivityRow, AreaSelection, formatWeekLabel, formatDollars } from "./trends-utils";

interface TrendsTableSectionProps {
    areas: AreaSelection[];
    rentResults: Record<string, TrendRow[]>;
    activityResults: Record<string, ActivityRow[]>;
    selectedBeds: number;
}

export function TrendsTableSection({ areas, rentResults, activityResults, selectedBeds }: TrendsTableSectionProps) {
    return (
        <div className="space-y-6">
            {areas.map(area => {
                const rentByWeek: Record<string, TrendRow> = {};
                (rentResults[area.id] ?? [])
                    .filter(r => r.beds === selectedBeds)
                    .forEach(r => { rentByWeek[r.week_start] = r; });

                const activityByWeek: Record<string, ActivityRow> = {};
                (activityResults[area.id] ?? [])
                    .filter(r => r.beds === selectedBeds)
                    .forEach(r => { activityByWeek[r.week_start] = r; });

                const allWeeks = Array.from(new Set([
                    ...Object.keys(rentByWeek),
                    ...Object.keys(activityByWeek),
                ])).sort((a, b) => b.localeCompare(a));

                if (allWeeks.length === 0) {
                    return (
                        <div key={area.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{area.label}</span>
                            </div>
                            <p className="text-sm text-gray-400">No data available</p>
                        </div>
                    );
                }

                return (
                    <div key={area.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{area.label}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/40">
                                        <th className="text-left px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Week</th>
                                        <th className="text-right px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Median Rent</th>
                                        <th className="text-right px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Inventory</th>
                                        <th className="text-right px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">New Listings</th>
                                        <th className="text-right px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Closed Listings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {allWeeks.map(week => {
                                        const rentRow = rentByWeek[week];
                                        const actRow = activityByWeek[week];
                                        return (
                                            <tr key={week} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                                <td className="px-5 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatWeekLabel(week)}</td>
                                                <td className="px-5 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                                    {rentRow ? formatDollars(Math.round(rentRow.median_rent)) : "—"}
                                                </td>
                                                <td className="px-5 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {actRow ? actRow.accumulated_listings.toLocaleString() : "—"}
                                                </td>
                                                <td className="px-5 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                                    {actRow ? actRow.new_listings.toLocaleString() : "—"}
                                                </td>
                                                <td className="px-5 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
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
