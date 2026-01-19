"use client";

import { ArrowUp, BarChart2, Building2, PieChart, Users, Download, Filter, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HoldingsPage() {
    return (
        <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6">
                <div className="max-w-7xl mx-auto w-full flex flex-col gap-10">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Portfolio Intelligence</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Holistic performance tracking for your multi-family assets.</p>
                        </div>
                        <div className="flex gap-3 w-full lg:w-auto">
                            <Button variant="outline" className="border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-semibold h-10">
                                <Download className="size-4" />
                                Export Report
                            </Button>
                            <Button className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 font-semibold h-10">
                                <Filter className="size-4" />
                                Manage Assets
                            </Button>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Units', value: '1,284', icon: Building2, delta: '+2.5%', color: 'gray' },
                            { label: 'Avg. Occupancy', value: '94.2%', icon: Users, delta: '+0.8%', color: 'gray' },
                            { label: 'Net Operating Income', value: '$2.14M', icon: BarChart2, delta: '+12.4%', color: 'gray' },
                            { label: 'Portfolio Val.', value: '$342M', icon: PieChart, delta: '+5.2%', color: 'gray' },
                        ].map((kpi, i) => (
                            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <kpi.icon className="size-6 text-gray-900 dark:text-gray-100" />
                                    </div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800">
                                        <ArrowUp className="size-3" />
                                        {kpi.delta}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{kpi.label}</p>
                                <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{kpi.value}</h3>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Properties Table */}
                        <div className="xl:col-span-2 flex flex-col gap-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Asset Breakdown</h2>
                                <button className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline">View all properties</button>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-x-auto shadow-sm bg-white dark:bg-gray-900">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Asset Name</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">NOI</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {[
                                            { name: 'Sunset Gardens', market: 'Miami, FL', status: 'Optimal', noi: '$142k', color: 'success' },
                                            { name: 'The Heights', market: 'Austin, TX', status: 'Renovating', noi: '$88k', color: 'warning' },
                                            { name: 'Riverway Lofts', market: 'Denver, CO', status: 'Optimal', noi: '$210k', color: 'success' },
                                            { name: 'Oak Springs', market: 'Atlanta, GA', status: 'Watchlist', noi: '$156k', color: 'error' },
                                            { name: 'Central Park', market: 'Phoenix, AZ', status: 'Optimal', noi: '$94k', color: 'success' },
                                        ].map((row, i) => (
                                            <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-700 shadow-sm">
                                                            <Building2 className="size-5 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 dark:text-gray-100 leading-tight text-sm">{row.name}</p>
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{row.market}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                        row.color === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800' :
                                                        row.color === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800' :
                                                        'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800'
                                                    }`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{row.noi} <span className="text-[10px] text-gray-400 font-medium">/ mo</span></p>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <button className="p-2 text-gray-300 dark:text-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
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
                            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-8">Market Diversification</h3>
                                <div className="flex flex-col md:flex-row items-center gap-12">
                                    <div className="size-32 bg-gray-50 dark:bg-gray-800 rounded-full border-[10px] border-gray-100 dark:border-gray-700 flex items-center justify-center relative shadow-inner shrink-0">
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-gray-900 dark:text-gray-100">5</p>
                                            <p className="text-[8px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Markets</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-5 w-full">
                                        {[
                                            { label: 'Miami', value: '35%', color: 'bg-gray-900 dark:bg-gray-100' },
                                            { label: 'Austin', value: '25%', color: 'bg-gray-600 dark:bg-gray-400' },
                                            { label: 'Denver', value: '20%', color: 'bg-gray-400 dark:bg-gray-600' },
                                            { label: 'Other', value: '20%', color: 'bg-gray-200 dark:bg-gray-800' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-2.5 rounded-full ${item.color} shadow-sm`} />
                                                    <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">{item.label}</span>
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
                    <div className="hidden xl:flex flex-col gap-8">
                        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-8">Market Diversification</h3>
                            <div className="flex justify-center mb-10">
                                <div className="size-32 bg-gray-50 dark:bg-gray-800 rounded-full border-[10px] border-gray-100 dark:border-gray-700 flex items-center justify-center relative shadow-inner">
                                    <div className="text-center">
                                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">5</p>
                                        <p className="text-[8px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Markets</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-5">
                                {[
                                    { label: 'Miami', value: '35%', color: 'bg-gray-900 dark:bg-gray-100' },
                                    { label: 'Austin', value: '25%', color: 'bg-gray-600 dark:bg-gray-400' },
                                    { label: 'Denver', value: '20%', color: 'bg-gray-400 dark:bg-gray-600' },
                                    { label: 'Other', value: '20%', color: 'bg-gray-200 dark:bg-gray-800' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-2.5 rounded-full ${item.color} shadow-sm`} />
                                            <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">{item.label}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="bg-gray-900 dark:bg-gray-100 rounded-2xl p-8 text-white dark:text-gray-900 shadow-xl overflow-hidden relative border border-gray-800 dark:border-gray-200">
                            <div className="relative z-10">
                                <h3 className="text-xl font-bold mb-2">Refinance Opportunity</h3>
                                <p className="text-gray-400 dark:text-gray-500 text-sm mb-8 leading-relaxed font-medium">Rates for your Phoenix asset just dropped by 0.5%.</p>
                                <Button className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 border-none font-bold h-11 shadow-sm">Review Details</Button>
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
