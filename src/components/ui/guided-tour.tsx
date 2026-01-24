"use client"

import * as React from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface TourStep {
  id: string
  target: string // CSS selector or ref
  title?: string
  content: React.ReactNode
  position?: "top" | "right" | "bottom" | "left"
}

interface GuidedTourProps {
  steps: TourStep[]
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  className?: string
}

export function GuidedTour({
  steps,
  isOpen,
  onClose,
  onComplete,
  className,
}: GuidedTourProps) {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [targetElement, setTargetElement] = React.useState<HTMLElement | null>(null)
  const [tooltipPosition, setTooltipPosition] = React.useState<{
    top: number
    left: number
    side: "top" | "right" | "bottom" | "left"
  } | null>(null)

  const currentStepData = steps[currentStep]

  // Find and position the target element
  React.useEffect(() => {
    if (!isOpen || !currentStepData) return

    const elements = document.querySelectorAll(currentStepData.target) as NodeListOf<HTMLElement>
    const element = elements[0] // Use first matching element
    if (!element) {
      console.warn(`Tour step target not found: ${currentStepData.target}`)
      return
    }

    setTargetElement(element)

    // Scroll element into view
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    })

    // Calculate position after a short delay to allow for scroll
    const timer = setTimeout(() => {
      const rect = element.getBoundingClientRect()
      const position = currentStepData.position || "bottom"
      
      let top = 0
      let left = 0
      let side: "top" | "right" | "bottom" | "left" = position

      switch (position) {
        case "top":
          top = rect.top - 10
          left = rect.left + rect.width / 2
          break
        case "bottom":
          top = rect.bottom + 10
          left = rect.left + rect.width / 2
          break
        case "left":
          top = rect.top + rect.height / 2
          left = rect.left - 10
          break
        case "right":
          top = rect.top + rect.height / 2
          left = rect.right + 10
          break
      }

      setTooltipPosition({ top, left, side })
    }, 300)

    return () => clearTimeout(timer)
  }, [isOpen, currentStep, currentStepData])

  // Reset on close
  React.useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0)
      setTargetElement(null)
      setTooltipPosition(null)
    }
  }, [isOpen])

  if (!isOpen || !currentStepData) return null

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete?.()
      onClose()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <>
      {/* Backdrop overlay - lighter and no blur */}
      <div
        className="fixed inset-0 z-[100] bg-black/20"
        onClick={handleSkip}
      />

      {/* Highlight overlay for target element - creates spotlight effect */}
      {targetElement && (
        <div
          className="fixed z-[101] pointer-events-none"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.3), 0 0 0 4px rgb(59, 130, 246)",
            borderRadius: "8px",
            transition: "all 0.3s ease",
          }}
        />
      )}

      {/* Tooltip */}
      {tooltipPosition && (
        <div
          className={cn(
            "fixed z-[102] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 p-4 min-w-[280px] max-w-[400px]",
            className
          )}
          style={{
            top: tooltipPosition.side === "bottom" 
              ? `${tooltipPosition.top}px` 
              : tooltipPosition.side === "top"
              ? "auto"
              : `${tooltipPosition.top}px`,
            bottom: tooltipPosition.side === "top" 
              ? `${window.innerHeight - tooltipPosition.top}px` 
              : "auto",
            left: tooltipPosition.side === "right" || tooltipPosition.side === "left"
              ? `${tooltipPosition.left}px`
              : `${tooltipPosition.left}px`,
            transform: tooltipPosition.side === "bottom" || tooltipPosition.side === "top"
              ? "translateX(-50%)"
              : tooltipPosition.side === "left"
              ? "translateX(-100%) translateY(-50%)"
              : "translateY(-50%)",
          }}
        >
          {/* Arrow pointing to target */}
          <div
            className={cn(
              "absolute w-0 h-0",
              tooltipPosition.side === "bottom" && "bottom-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white dark:border-b-gray-900",
              tooltipPosition.side === "top" && "top-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-gray-900",
              tooltipPosition.side === "right" && "right-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white dark:border-r-gray-900",
              tooltipPosition.side === "left" && "left-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white dark:border-l-gray-900"
            )}
          />

          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label="Close tour"
          >
            <X className="size-4" />
          </button>

          {/* Content */}
          <div className="pr-6">
            {currentStepData.title && (
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {currentStepData.title}
              </h3>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {currentStepData.content}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Step {currentStep + 1} of {steps.length}
            </div>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="h-8"
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Previous
                </Button>
              )}
              <Button
                onClick={handleNext}
                size="sm"
                className="h-8 bg-black hover:bg-gray-900 text-white"
              >
                {currentStep < steps.length - 1 ? (
                  <>
                    Next
                    <ChevronRight className="size-4 ml-1" />
                  </>
                ) : (
                  "Finish"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
