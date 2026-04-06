"use client";

import { ArrowUp, BarChart2, Building2, Download, Filter, MoreVertical, PieChart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HoldingsPage() {
    return (
        <div className="flex h-full flex-col overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
                    <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Portfolio Intelligence</h1>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Holistic performance tracking for your multi-family assets.</p>
                        </div>
                        <div className="flex w-full gap-3 lg:w-auto">
                            <Button variant="outline" className="h-10 border-gray-200 font-semibold text-gray-700 dark:border-gray-800 dark:text-gray-300">
                                <Download className="size-4" />
                                Export Report
                            </Button>
                            <Button className="h-10 bg-gray-900 font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200">
                                <Filter className="size-4" />
                                Manage Assets
                            </Button>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: "Total Units", value: "1,284", icon: Building2, delta: "+2.5%", color: "gray" },
                            { label: "Avg. Occupancy", value: "94.2%", icon: Users, delta: "+0.8%", color: "gray" },
                            { label: "Net Operating Income", value: "$2.14M", icon: BarChart2, delta: "+12.4%", color: "gray" },
                            { label: "Portfolio Val.", value: "$342M", icon: PieChart, delta: "+5.2%", color: "gray" },
                        ].map((kpi, i) => (
                            <div
                                key={i}
                                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                            >
                                <div className="mb-6 flex items-start justify-between">
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                                        <kpi.icon className="size-6 text-gray-900 dark:text-gray-100" />
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2.5 py-0.5 text-[10px] font-bold text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                                        <ArrowUp className="size-3" />
                                        {kpi.delta}
                                    </span>
                                </div>
                                <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-400 uppercase dark:text-gray-500">{kpi.label}</p>
                                <h3 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{kpi.value}</h3>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                        {/* Properties Table */}
                        <div className="flex flex-col gap-6 xl:col-span-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Asset Breakdown</h2>
                                <button className="text-xs font-bold tracking-wider text-blue-600 uppercase hover:underline dark:text-blue-400">
                                    View all properties
                                </button>
                            </div>
                            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <table className="w-full text-left">
                                    <thead className="border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/50">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase dark:text-gray-500">
                                                Asset Name
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase dark:text-gray-500">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase dark:text-gray-500">NOI</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-bold tracking-widest text-gray-400 uppercase dark:text-gray-500">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {[
                                            { name: "Sunset Gardens", market: "Miami, FL", status: "Optimal", noi: "$142k", color: "success" },
                                            { name: "The Heights", market: "Austin, TX", status: "Renovating", noi: "$88k", color: "warning" },
                                            { name: "Riverway Lofts", market: "Denver, CO", status: "Optimal", noi: "$210k", color: "success" },
                                            { name: "Oak Springs", market: "Atlanta, GA", status: "Watchlist", noi: "$156k", color: "error" },
                                            { name: "Central Park", market: "Phoenix, AZ", status: "Optimal", noi: "$94k", color: "success" },
                                        ].map((row, i) => (
                                            <tr key={i} className="group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                                            <Building2 className="size-5 text-gray-400 transition-colors group-hover:text-gray-900 dark:group-hover:text-gray-100" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm leading-tight font-bold text-gray-900 dark:text-gray-100">{row.name}</p>
                                                            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{row.market}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                                                            row.color === "success"
                                                                ? "border-green-100 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                                                                : row.color === "warning"
                                                                  ? "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                                                                  : "border-red-100 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                                                        }`}
                                                    >
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                                        {row.noi} <span className="text-[10px] font-medium text-gray-400">/ mo</span>
                                                    </p>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <button className="p-2 text-gray-300 transition-colors hover:text-gray-900 dark:text-gray-700 dark:hover:text-gray-100">
                                                        <MoreVertical className="size-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Performance Trends Sidebar Content for Tablet/Mobile */}
                        <div className="flex flex-col gap-8 xl:hidden">
                            {/* Diversification Card */}
                            <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h3 className="mb-8 text-lg font-bold text-gray-900 dark:text-gray-100">Market Diversification</h3>
                                <div className="flex flex-col items-center gap-12 md:flex-row">
                                    <div className="relative flex size-32 shrink-0 items-center justify-center rounded-full border-[10px] border-gray-100 bg-gray-50 shadow-inner dark:border-gray-700 dark:bg-gray-800">
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-gray-900 dark:text-gray-100">5</p>
                                            <p className="text-[8px] font-bold tracking-widest text-gray-400 uppercase dark:text-gray-500">Markets</p>
                                        </div>
                                    </div>
                                    <div className="w-full flex-1 space-y-5">
                                        {[
                                            { label: "Miami", value: "35%", color: "bg-gray-900 dark:bg-gray-100" },
                                            { label: "Austin", value: "25%", color: "bg-gray-600 dark:bg-gray-400" },
                                            { label: "Denver", value: "20%", color: "bg-gray-400 dark:bg-gray-600" },
                                            { label: "Other", value: "20%", color: "bg-gray-200 dark:bg-gray-800" },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-2.5 rounded-full ${item.color} shadow-sm`} />
                                                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{item.label}</span>
                                                </div>
                                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Performance Trends Sidebar Desktop */}
                    <div className="hidden flex-col gap-8 xl:flex">
                        <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <h3 className="mb-8 text-lg font-bold text-gray-900 dark:text-gray-100">Market Diversification</h3>
                            <div className="mb-10 flex justify-center">
                                <div className="relative flex size-32 items-center justify-center rounded-full border-[10px] border-gray-100 bg-gray-50 shadow-inner dark:border-gray-700 dark:bg-gray-800">
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">5</p>
                                        <p className="text-[8px] font-bold tracking-widest text-gray-400 uppercase dark:text-gray-500">Markets</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-5">
                                {[
                                    { label: "Miami", value: "35%", color: "bg-gray-900 dark:bg-gray-100" },
                                    { label: "Austin", value: "25%", color: "bg-gray-600 dark:bg-gray-400" },
                                    { label: "Denver", value: "20%", color: "bg-gray-400 dark:bg-gray-600" },
                                    { label: "Other", value: "20%", color: "bg-gray-200 dark:bg-gray-800" },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-2.5 rounded-full ${item.color} shadow-sm`} />
                                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{item.label}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-8 text-white shadow-xl dark:border-gray-200 dark:bg-gray-100 dark:text-gray-900">
                            <div className="relative z-10">
                                <h3 className="mb-2 text-xl font-bold">Refinance Opportunity</h3>
                                <p className="mb-8 text-sm leading-relaxed font-medium text-gray-400 dark:text-gray-500">
                                    Rates for your Phoenix asset just dropped by 0.5%.
                                </p>
                                <Button className="h-11 w-full border-none bg-white font-bold text-gray-900 shadow-sm hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800">
                                    Review Details
                                </Button>
                            </div>
                            <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.03] dark:opacity-[0.05]">
                                <PieChart className="size-40" />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
