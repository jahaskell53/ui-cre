"use client"

import * as React from "react"
import { HelpCircle } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface HelpTooltipProps {
  content: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  className?: string
  iconClassName?: string
}

export function HelpTooltip({
  content,
  side = "top",
  className,
  iconClassName,
}: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-100 ease-linear focus:outline-none focus:text-gray-600 dark:focus:text-gray-300",
            className
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
  )
}
