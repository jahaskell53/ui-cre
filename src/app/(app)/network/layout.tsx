"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { DetailPanel } from "./components/detail-panel";
import { TabNavigation } from "./components/tab-navigation";
import { PeopleProvider, type SortBy } from "./people-context";
import type { Person } from "./types";

export default function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [panelWidth, setPanelWidth] = useState(340);
  const [isDragging, setIsDragging] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>('recency');
  const [reverse, setReverse] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Check if we're on a detail page (e.g., /network/[id] or /network/[id]/edit)
  const isDetailPage = pathname?.match(/^\/network\/[^/]+(\/.*)?$/) && 
                       pathname !== "/network/create" &&
                       pathname !== "/network/board" &&
                       pathname !== "/network/map";
  
  const shouldHideDetailPanel = pathname === "/network/create" ||
                                isDetailPage;
  
  const shouldHideTabs = isDetailPage || pathname === "/network/create";

  // Fetch people from database
  const fetchPeople = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/people");
      if (!response.ok) {
        throw new Error("Failed to fetch people");
      }
      const data = await response.json();
      setPeople(data);
      if (data.length > 0 && !selectedPerson) {
        setSelectedPerson(data[0]);
      }
    } catch (error) {
      console.error("Error fetching people:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when navigating to /network after being away
  useEffect(() => {
    if (pathname === "/network") {
      fetchPeople();
    }
  }, [pathname]);

  // Refetch when page becomes visible (user returns to tab) and we're on the main /network page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && pathname === "/network") {
        fetchPeople();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 340;
      const maxWidth = 800;
      setPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  return (
    <PeopleProvider
      value={{
        people,
        setPeople,
        selectedPerson,
        setSelectedPerson,
        loading,
        showStarredOnly,
        setShowStarredOnly,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        reverse,
        setReverse,
        selectedIds,
        setSelectedIds,
        refetchPeople: fetchPeople,
      }}
    >
      <div className="flex h-full w-full">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-gray-900">
          {!shouldHideTabs && <TabNavigation sortBy={sortBy} reverse={reverse} onSortChange={setSortBy} onReverseChange={setReverse} />}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {children}
          </div>
        </div>

        {/* Resizable Divider */}
        {!shouldHideDetailPanel && (
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            className="w-1 flex items-center justify-center cursor-col-resize flex-shrink-0 group"
          >
            <div className="w-px h-full bg-gray-200 dark:bg-gray-800 group-hover:bg-gray-300 dark:group-hover:bg-gray-700 transition-colors" />
          </div>
        )}

        {/* Right Detail Panel */}
        {!shouldHideDetailPanel && (
          <DetailPanel selectedPerson={selectedPerson} panelWidth={panelWidth} />
        )}
      </div>
    </PeopleProvider>
  );
}
