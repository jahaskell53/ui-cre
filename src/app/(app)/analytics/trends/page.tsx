"use client";

import {
    TrendingUp,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TrendsPage() {
    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cap Rate Trends */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Cap Rate Trends</h3>
                        <span className="text-xs text-gray-500">Last 12 months</span>
                    </div>
                    <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <BarChart3 className="size-12 text-blue-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">Chart visualization</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="flex items-center gap-1 text-green-600">
                            <ArrowUpRight className="size-4" />
                            <span className="text-sm font-medium">+0.3%</span>
                        </div>
                        <span className="text-sm text-gray-500">vs last quarter</span>
                    </div>
                </div>

                {/* Market Heatmap */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Market Heatmap</h3>
                        <select className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            <option>Bay Area</option>
                            <option>Los Angeles</option>
                            <option>San Diego</option>
                        </select>
                    </div>
                    <div className="h-48 bg-gradient-to-br from-green-100 via-yellow-100 to-red-100 dark:from-green-900/30 dark:via-yellow-900/30 dark:to-red-900/30 rounded-lg flex items-center justify-center relative overflow-hidden">
                        {/* Mock heatmap regions */}
                        <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-1 p-2">
                            {[...Array(12)].map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "rounded opacity-60",
                                        i % 3 === 0 ? "bg-green-400" : i % 3 === 1 ? "bg-yellow-400" : "bg-red-400"
                                    )}
                                />
                            ))}
                        </div>
                        <div className="relative z-10 bg-white/80 dark:bg-gray-900/80 px-3 py-1.5 rounded-lg">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Choropleth Map</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" /> Low</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded" /> Medium</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" /> High</span>
                    </div>
                </div>

                {/* Price per Sqft */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Price per Sq Ft</h3>
                        <span className="text-xs text-gray-500">By neighborhood</span>
                    </div>
                    <div className="space-y-3">
                        {[
                            { name: "Mission District", value: 1250, change: 5.2 },
                            { name: "SOMA", value: 1480, change: -2.1 },
                            { name: "Nob Hill", value: 1820, change: 3.8 },
                            { name: "Castro", value: 1340, change: 1.5 },
                        ].map((item) => (
                            <div key={item.name} className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        ${item.value.toLocaleString()}
                                    </span>
                                    <span className={cn(
                                        "text-xs flex items-center gap-0.5",
                                        item.change > 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                        {item.change > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                                        {Math.abs(item.change)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rent Trends */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Avg Rent Trends</h3>
                        <span className="text-xs text-gray-500">Monthly</span>
                    </div>
                    <div className="h-32 flex items-end justify-between gap-2 px-2">
                        {[65, 70, 68, 75, 82, 78, 85, 88, 92, 90, 95, 98].map((h, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t"
                                style={{ height: `${h}%` }}
                            />
                        ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                        <span>Jan</span>
                        <span>Jun</span>
                        <span>Dec</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
