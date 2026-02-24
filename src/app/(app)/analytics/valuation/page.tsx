"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { IrrProjectionChart } from "@/components/application/irr-projection-chart";
import { ValuationCard } from "@/components/application/valuation-card";

export default function ValuationPage() {
    const [capRate, setCapRate] = useState(4.5);
    const [rent, setRent] = useState(3000);
    const [vacancy, setVacancy] = useState(5);

    const annualRent = rent * 12 * 11 * (1 - vacancy / 100);
    const estimatedValue = Math.round(annualRent / (capRate / 100));
    const irr = 12.1;

    return (
        <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Property Selection */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Property</h3>
                        <div className="flex gap-4">
                            <div className="w-24 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                <Building2 className="size-8 text-gray-400" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">1228 El Camino</h4>
                                <p className="text-sm text-gray-500 mt-1">Palo Alto, CA</p>
                                <p className="text-xs text-gray-400 mt-2">11 Units • 8,500 sq ft</p>
                            </div>
                        </div>
                    </div>

                    {/* Valuation Result */}
                    <ValuationCard
                        title="Estimated Valuation"
                        value={estimatedValue}
                        irr={irr}
                        noi={Math.round(annualRent)}
                    />
                </div>

                {/* Sliders */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-6">Adjust Parameters</h3>

                    <div className="space-y-8">
                        {/* Cap Rate Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">Cap Rate</Label>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{capRate}%</span>
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
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>1%</span>
                                <span>10%</span>
                            </div>
                        </div>

                        {/* Rent Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">Avg Monthly Rent</Label>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    ${rent.toLocaleString()}
                                </span>
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
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>$1,000</span>
                                <span>$8,000</span>
                            </div>
                        </div>

                        {/* Vacancy Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">Vacancy Rate</Label>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{vacancy}%</span>
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
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>0%</span>
                                <span>20%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* IRR projection */}
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <IrrProjectionChart currentIrr={irr} years={5} height={180} />
                </div>
            </div>
        </div>
    );
}
