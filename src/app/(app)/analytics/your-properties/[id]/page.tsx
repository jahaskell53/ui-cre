"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Building2,
    ChevronLeft,
    DollarSign,
    MapPin,
    BarChart3,
    Home,
    Layers,
    Calculator,
    Save,
    TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IrrProjectionChart } from "@/components/application/irr-projection-chart";

// Same shape as analytics page mock; in production fetch by id
const MOCK_USER_PROPERTIES: { id: number; address: string; capRate: number; image: string | null }[] = [
    { id: 1, address: "1228 El Camino", capRate: 5.2, image: null },
    { id: 2, address: "550 Blake", capRate: 3.47, image: null },
    { id: 3, address: "3541 Mission", capRate: 2.67, image: null },
];

export default function PropertyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id === undefined ? null : Number(params.id);
    const property = id === null ? null : MOCK_USER_PROPERTIES.find((p) => p.id === id);

    const [capRate, setCapRate] = useState(property?.capRate ?? 4.5);
    const [rent, setRent] = useState(3000);
    const [vacancy, setVacancy] = useState(5);

    const units = 11;
    const annualRent = rent * 12 * units * (1 - vacancy / 100);
    const estimatedValue = Math.round(annualRent / (capRate / 100));
    const irr = 12.1;

    if (property === undefined || property === null) {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
                <div className="p-6">
                    <Link
                        href="/analytics"
                        className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                        <ChevronLeft className="size-4" />
                        Back to Analytics
                    </Link>
                    <div className="mt-8 text-center py-12">
                        <Building2 className="size-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Property not found</h2>
                        <p className="text-sm text-gray-500 mt-1">This property may have been removed or the link is invalid.</p>
                        <Button variant="outline" className="mt-4" onClick={() => router.push("/analytics")}>
                            Back to Analytics
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-auto">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
                <Link
                    href="/analytics"
                    className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
                >
                    <ChevronLeft className="size-4" />
                    Back to Analytics
                </Link>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{property.address}</h1>
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            Your property
                        </p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{property.capRate}%</span>
                        <span className="text-xs text-gray-500 ml-1">Cap Rate</span>
                    </div>
                </div>
            </div>

            {/* Hero / Image area */}
            <div className="aspect-[3/1] min-h-[180px] bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <Building2 className="size-16 text-gray-400 dark:text-gray-500" />
            </div>

            {/* Cap rate vs peers banner */}
            <div className="px-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                    <div className="size-8 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Your cap rate is below peers</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                            Properties in your portfolio have an average cap rate of 3.2%, which is 0.8% below market average.
                            <button type="button" className="ml-1 underline">Find out why →</button>
                        </p>
                    </div>
                </div>
            </div>

            {/* Detail sections */}
            <div className="flex-1 p-6 max-w-4xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Overview */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <Home className="size-4" />
                            Overview
                        </h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">Address</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">{property.address}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">Cap Rate</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">{property.capRate}%</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">Active</dd>
                            </div>
                        </dl>
                    </section>

                    {/* Financials */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <DollarSign className="size-4" />
                            Financials
                        </h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">Est. Value</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">NOI</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500 dark:text-gray-400">Gross Rent</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                        </dl>
                    </section>

                    {/* Performance */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:col-span-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <BarChart3 className="size-4" />
                            Performance
                        </h3>
                        <div className="h-32 bg-gray-100 dark:bg-gray-700/50 rounded-lg flex items-center justify-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Performance chart</p>
                        </div>
                    </section>

                    {/* Property details */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:col-span-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <Layers className="size-4" />
                            Property Details
                        </h3>
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">Units</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">Beds</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">Baths</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">Sq Ft</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">Year Built</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                                <dd className="font-medium text-gray-900 dark:text-gray-100">—</dd>
                            </div>
                        </dl>
                    </section>

                    {/* Rent and Sales Comp */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:col-span-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <TrendingUp className="size-4" />
                            Rent and Sales Comp
                        </h3>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Analysis</h4>
                        <ul className="space-y-4 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400">i.</span>
                                <span><strong className="text-gray-900 dark:text-gray-100">Rent (current)</strong> — ${rent.toLocaleString()}/mo</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400">ii.</span>
                                <div className="flex-1">
                                    <strong className="text-gray-900 dark:text-gray-100">Rent chart</strong>
                                    <p className="text-gray-500 dark:text-gray-400 mt-0.5">Chart shows information over time.</p>
                                    <div className="mt-2 h-24 flex items-end justify-between gap-1 px-1">
                                        {[65, 70, 68, 75, 82, 78, 85, 88, 92, 90, 95, 98].map((h, i) => (
                                            <div
                                                key={i}
                                                className="flex-1 min-w-0 bg-indigo-500 dark:bg-indigo-400 rounded-t"
                                                style={{ height: `${h}%` }}
                                            />
                                        ))}
                                    </div>
                                    <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                                        <span>Jan</span>
                                        <span>Jun</span>
                                        <span>Dec</span>
                                    </div>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400">iii.</span>
                                <span><strong className="text-gray-900 dark:text-gray-100">Rent velocity</strong> — Presentation TBD.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400">iv.</span>
                                <div className="flex-1">
                                    <strong className="text-gray-900 dark:text-gray-100">Sales comps</strong>
                                    <p className="text-gray-500 dark:text-gray-400 mt-0.5">Cap rate, price/door, price/sq-ft.</p>
                                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                        <div><dt className="text-gray-500 dark:text-gray-400">Cap rate</dt><dd className="font-medium text-gray-900 dark:text-gray-100">3.2%</dd></div>
                                        <div><dt className="text-gray-500 dark:text-gray-400">Price/door</dt><dd className="font-medium text-gray-900 dark:text-gray-100">$165k</dd></div>
                                        <div><dt className="text-gray-500 dark:text-gray-400">Price/sq-ft</dt><dd className="font-medium text-gray-900 dark:text-gray-100">$420</dd></div>
                                    </dl>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400">v.</span>
                                <div className="flex-1">
                                    <strong className="text-gray-900 dark:text-gray-100">Sales comps chart</strong>
                                    <p className="text-gray-500 dark:text-gray-400 mt-0.5">Chart shows information over time.</p>
                                    <div className="mt-2 h-24 flex items-end justify-between gap-1 px-1">
                                        {[72, 68, 75, 71, 78, 74, 80, 76, 82, 79, 85, 88].map((h, i) => (
                                            <div
                                                key={i}
                                                className="flex-1 min-w-0 bg-blue-500 dark:bg-blue-400 rounded-t"
                                                style={{ height: `${h}%` }}
                                            />
                                        ))}
                                    </div>
                                    <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                                        <span>Jan</span>
                                        <span>Jun</span>
                                        <span>Dec</span>
                                    </div>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400">vi.</span>
                                <div className="flex-1">
                                    <strong className="text-gray-900 dark:text-gray-100">Sales volume</strong>
                                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                        <div><dt className="text-gray-500 dark:text-gray-400">Monthly</dt><dd className="font-medium text-gray-900 dark:text-gray-100">$2.4M</dd></div>
                                        <div><dt className="text-gray-500 dark:text-gray-400">Quarterly</dt><dd className="font-medium text-gray-900 dark:text-gray-100">$7.1M</dd></div>
                                        <div><dt className="text-gray-500 dark:text-gray-400">Yearly</dt><dd className="font-medium text-gray-900 dark:text-gray-100">$28.2M</dd></div>
                                    </dl>
                                </div>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-gray-500 dark:text-gray-400">vii.</span>
                                <div className="flex-1">
                                    <strong className="text-gray-900 dark:text-gray-100">Sales velocity</strong>
                                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                        <div><dt className="text-gray-500 dark:text-gray-400">Monthly</dt><dd className="font-medium text-gray-900 dark:text-gray-100">14</dd></div>
                                        <div><dt className="text-gray-500 dark:text-gray-400">Quarterly</dt><dd className="font-medium text-gray-900 dark:text-gray-100">42</dd></div>
                                        <div><dt className="text-gray-500 dark:text-gray-400">Yearly</dt><dd className="font-medium text-gray-900 dark:text-gray-100">168</dd></div>
                                    </dl>
                                </div>
                            </li>
                        </ul>
                    </section>

                    {/* Evaluation */}
                    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:col-span-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
                            <Calculator className="size-4" />
                            Evaluation
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-blue-100">Estimated Value</span>
                                    <Button size="sm" variant="secondary" className="h-7 text-xs gap-1">
                                        <Save className="size-3" />
                                        Save
                                    </Button>
                                </div>
                                <p className="text-3xl font-bold">${estimatedValue.toLocaleString()}</p>
                                <div className="mt-4 flex items-center gap-4 text-sm">
                                    <div>
                                        <span className="text-blue-200">IRR</span>
                                        <span className="ml-2 font-semibold">{irr}%</span>
                                    </div>
                                    <div>
                                        <span className="text-blue-200">NOI</span>
                                        <span className="ml-2 font-semibold">${Math.round(annualRent).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <Label className="text-sm">Cap Rate</Label>
                                        <span className="text-sm font-semibold">{capRate}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="0.1"
                                        value={capRate}
                                        onChange={(e) => setCapRate(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <Label className="text-sm">Avg Monthly Rent</Label>
                                        <span className="text-sm font-semibold">${rent.toLocaleString()}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1000"
                                        max="8000"
                                        step="100"
                                        value={rent}
                                        onChange={(e) => setRent(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <Label className="text-sm">Vacancy Rate</Label>
                                        <span className="text-sm font-semibold">{vacancy}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="20"
                                        step="1"
                                        value={vacancy}
                                        onChange={(e) => setVacancy(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
                            <IrrProjectionChart currentIrr={irr} years={5} height={180} />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
