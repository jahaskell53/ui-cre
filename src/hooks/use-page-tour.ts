"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase";
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

  // Mark page as visited in Supabase
  const markPageAsVisited = useCallback(async (path: string) => {
    if (!user || !pathname) return;

    try {
      // Get current visited pages
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("tour_visited_pages")
        .eq("id", user.id)
        .single();

      const currentPages = (currentProfile?.tour_visited_pages as string[]) || [];
      
      // Add new path if not already present
      if (!currentPages.includes(path)) {
        const updatedPages = [...currentPages, path];
        
        // Update in Supabase
        const { error } = await supabase
          .from("profiles")
          .update({ tour_visited_pages: updatedPages })
          .eq("id", user.id);

        if (!error) {
          setVisitedPages(new Set(updatedPages));
        }
      }
    } catch (error) {
      console.error("Error marking page as visited:", error);
    }
  }, [user, pathname]);

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

    window.addEventListener('trigger-page-tour', handleTourTrigger);
    return () => {
      window.removeEventListener('trigger-page-tour', handleTourTrigger);
    };
  }, [pathname, onTourTrigger, visitedPages, isLoadingVisitedPages, markPageAsVisited]);
}
