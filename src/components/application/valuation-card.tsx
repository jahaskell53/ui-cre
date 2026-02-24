"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ValuationCardProps {
    title: string;
    value: number;
    irr: number;
    noi: number;
    compact?: boolean;
}

export function ValuationCard({ title, value, irr, noi, compact }: ValuationCardProps) {
    return (
        <div
            className={
                compact
                    ? "bg-black rounded-xl p-5 text-white"
                    : "bg-black rounded-xl p-6 text-white"
            }
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-white">{title}</h3>
                <Button size="sm" variant="secondary" className="h-7 text-xs gap-1">
                    <Save className="size-3" />
                    Save
                </Button>
            </div>
            <p className={compact ? "text-3xl font-bold" : "text-4xl font-bold"}>
                ${value.toLocaleString()}
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm">
                <div>
                    <span className="text-white">IRR</span>
                    <span className="ml-2 font-semibold">{irr}%</span>
                </div>
                <div>
                    <span className="text-white">NOI</span>
                    <span className="ml-2 font-semibold">${noi.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}
