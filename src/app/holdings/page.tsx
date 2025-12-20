"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { ArrowUp, BarChartSquare01, Building02, PieChart01, Users01, Download01, FilterLines, DotsVertical } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Avatar } from "@/components/base/avatar/avatar";

export default function HoldingsPage() {
    return (
        <MainLayout>
            <div className="flex flex-col gap-10">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                    <div>
                        <h1 className="text-display-sm font-semibold text-primary">Portfolio Intelligence</h1>
                        <p className="text-lg text-tertiary">Holistic performance tracking for your multi-family assets.</p>
                    </div>
                    <div className="flex gap-3 w-full lg:w-auto">
                        <Button color="secondary" iconLeading={Download01}>Export Report</Button>
                        <Button color="primary" iconLeading={FilterLines}>Manage Assets</Button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Units', value: '1,284', icon: Building02, delta: '+2.5%', color: 'brand' },
                        { label: 'Avg. Occupancy', value: '94.2%', icon: Users01, delta: '+0.8%', color: 'success' },
                        { label: 'Net Operating Income', value: '$2.14M', icon: BarChartSquare01, delta: '+12.4%', color: 'blue' },
                        { label: 'Portfolio Val.', value: '$342M', icon: PieChart01, delta: '+5.2%', color: 'indigo' },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-primary border border-secondary p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-6">
                                <div className={`p-3 bg-secondary rounded-xl`}>
                                    <kpi.icon className="size-6 text-primary" />
                                </div>
                                <Badge color="success" size="sm" type="pill-color" className="gap-1 px-1.5 py-0.5">
                                    <ArrowUp className="size-3" />
                                    {kpi.delta}
                                </Badge>
                            </div>
                            <p className="text-sm font-bold text-quaternary uppercase tracking-widest mb-1">{kpi.label}</p>
                            <h3 className="text-3xl font-bold text-primary tracking-tight">{kpi.value}</h3>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Properties Table */}
                    <div className="xl:col-span-2 flex flex-col gap-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-primary">Asset Breakdown</h2>
                            <button className="text-sm font-semibold text-brand-solid hover:text-brand-tertiary">View all properties</button>
                        </div>
                        <div className="border border-secondary rounded-2xl overflow-hidden shadow-sm bg-primary">
                            <table className="w-full text-left">
                                <thead className="bg-secondary/50 border-b border-secondary">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest">Asset Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest">NOI</th>
                                        <th className="px-6 py-4 text-xs font-bold text-quaternary uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary">
                                    {[
                                        { name: 'Sunset Gardens', market: 'Miami, FL', status: 'Optimal', noi: '$142k', color: 'success' },
                                        { name: 'The Heights', market: 'Austin, TX', status: 'Renovating', noi: '$88k', color: 'warning' },
                                        { name: 'Riverway Lofts', market: 'Denver, CO', status: 'Optimal', noi: '$210k', color: 'success' },
                                        { name: 'Oak Springs', market: 'Atlanta, GA', status: 'Watchlist', noi: '$156k', color: 'error' },
                                        { name: 'Central Park', market: 'Phoenix, AZ', status: 'Optimal', noi: '$94k', color: 'success' },
                                    ].map((row, i) => (
                                        <tr key={i} className="group hover:bg-secondary/30 transition-colors cursor-pointer">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                                                        <Building02 className="size-5 text-quaternary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-primary leading-tight">{row.name}</p>
                                                        <p className="text-xs text-tertiary">{row.market}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge color={row.color as any} size="sm" type="color">
                                                    {row.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-primary">{row.noi} <span className="text-[10px] text-tertiary font-medium">/ mo</span></p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 text-quaternary hover:text-primary transition-colors">
                                                    <DotsVertical className="size-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Performance Trends Sidebar */}
                    <div className="flex flex-col gap-8">
                        <section className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-primary mb-6">Market Diversification</h3>
                            <div className="aspect-square bg-secondary/30 rounded-full border-8 border-brand-solid/10 flex items-center justify-center relative mb-6">
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-primary">5</p>
                                    <p className="text-xs text-tertiary font-medium">Markets</p>
                                </div>
                                {/* Mock doughnut pieces */}
                                <div className="absolute inset-0 border-8 border-brand-solid border-t-transparent border-l-transparent rounded-full rotate-45" />
                            </div>
                            <div className="space-y-4">
                                {[
                                    { label: 'Miami', value: '35%', color: 'bg-brand-solid' },
                                    { label: 'Austin', value: '25%', color: 'bg-brand-tertiary' },
                                    { label: 'Denver', value: '20%', color: 'bg-blue-600' },
                                    { label: 'Other', value: '20%', color: 'bg-secondary' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`size-2 rounded-full ${item.color}`} />
                                            <span className="text-sm text-secondary font-medium">{item.label}</span>
                                        </div>
                                        <span className="text-sm font-bold text-primary">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="bg-brand-solid rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-2">Refinance Opportunity</h3>
                                <p className="text-brand-secondary text-sm mb-6">Rates for your Phoenix asset just dropped by 0.5%.</p>
                                <Button className="w-full bg-white text-brand-solid hover:bg-brand-secondary border-none font-bold">Review Details</Button>
                            </div>
                            <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
                                <PieChart01 className="size-24" />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
