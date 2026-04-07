"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/use-user";

/**
 * Hook that automatically triggers a tour on first visit to a page,
 * and also listens for the 'trigger-page-tour' custom event from the sidebar.
 *
 * @param onTourTrigger Callback function to call when the tour is triggered
 */
export function usePageTour(onTourTrigger: () => void) {
    const pathname = usePathname();
    const { user, profile, loading: userLoading } = useUser();
    const [visitedPages, setVisitedPages] = useState<Set<string>>(new Set());
    const [isLoadingVisitedPages, setIsLoadingVisitedPages] = useState(true);

    // Load visited pages from profile
    useEffect(() => {
        if (userLoading) return;

        if (user && profile) {
            // Load from Supabase profile
            const pages = profile.tour_visited_pages || [];
            setVisitedPages(new Set(pages));
            setIsLoadingVisitedPages(false);
        } else {
            // Not logged in, use empty set
            setVisitedPages(new Set());
            setIsLoadingVisitedPages(false);
        }
    }, [user, profile, userLoading]);

    // Mark page as visited via API
    const markPageAsVisited = useCallback(
        async (path: string) => {
            if (!user || !pathname) return;

            try {
                const response = await fetch("/api/profile/tour", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setVisitedPages(new Set(data.tour_visited_pages as string[]));
                }
            } catch (error) {
                console.error("Error marking page as visited:", error);
            }
        },
        [user, pathname],
    );

    useEffect(() => {
        // Wait for visited pages to load
        if (isLoadingVisitedPages) return;

        // Check if this is the first visit to this page
        const isFirstVisit = pathname && !visitedPages.has(pathname);

        // Auto-trigger tour on first visit
        if (isFirstVisit && pathname) {
            // Small delay to ensure page is fully rendered
            const timeoutId = setTimeout(() => {
                onTourTrigger();
                markPageAsVisited(pathname);
            }, 500);
            return () => clearTimeout(timeoutId);
        }

        // Also listen for manual tour trigger from sidebar
        const handleTourTrigger = () => {
            onTourTrigger();
            // Mark as visited when manually triggered too
            if (pathname) {
                markPageAsVisited(pathname);
            }
        };

        window.addEventListener("trigger-page-tour", handleTourTrigger);
        return () => {
            window.removeEventListener("trigger-page-tour", handleTourTrigger);
        };
    }, [pathname, onTourTrigger, visitedPages, isLoadingVisitedPages, markPageAsVisited]);
}
