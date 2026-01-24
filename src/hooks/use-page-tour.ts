"use client";

import { useEffect } from "react";

/**
 * Hook that listens for the 'trigger-page-tour' custom event from the sidebar
 * and calls the provided callback when triggered.
 *
 * @param onTourTrigger Callback function to call when the tour is triggered
 */
export function usePageTour(onTourTrigger: () => void) {
  useEffect(() => {
    const handleTourTrigger = () => {
      onTourTrigger();
    };
    window.addEventListener('trigger-page-tour', handleTourTrigger);
    return () => {
      window.removeEventListener('trigger-page-tour', handleTourTrigger);
    };
  }, [onTourTrigger]);
}
