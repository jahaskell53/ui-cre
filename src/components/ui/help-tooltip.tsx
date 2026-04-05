"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
    content: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    className?: string;
    iconClassName?: string;
}

export function HelpTooltip({ content, side = "top", className, iconClassName }: HelpTooltipProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex cursor-pointer items-center justify-center text-gray-400 transition-colors duration-100 ease-linear hover:text-gray-600 focus:text-gray-600 focus:outline-none dark:text-gray-500 dark:hover:text-gray-300 dark:focus:text-gray-300",
                        className,
                    )}
                    aria-label="Help"
                >
                    <HelpCircle className={cn("size-4", iconClassName)} />
                </button>
            </TooltipTrigger>
            <TooltipContent side={side} className="max-w-xs">
                {content}
            </TooltipContent>
        </Tooltip>
    );
}
