"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar, type SidebarRef } from "./components/sidebar";
import { DetailPanel } from "./components/detail-panel";
import { TabNavigation } from "./components/tab-navigation";
import { PeopleProvider, type SortBy } from "./people-context";
import { useUser } from "@/hooks/use-user";
import type { Person } from "./types";

export default function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useUser();
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
  const sidebarRef = useRef<SidebarRef>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Check if we're on a detail page (e.g., /people/[id] or /people/[id]/edit)
  const isDetailPage = pathname?.match(/^\/people\/[^/]+(\/.*)?$/) && 
                       pathname !== "/people/settings" && 
                       pathname !== "/people/create" &&
                       pathname !== "/people/board" &&
                       pathname !== "/people/map" &&
                       pathname !== "/people/profile";
  
  const shouldHideDetailPanel = pathname === "/people/settings" || 
                                pathname === "/people/create" || 
                                pathname === "/people/profile" ||
                                isDetailPage;
  
  const shouldHideTabs = isDetailPage || pathname === "/people/settings" || pathname === "/people/create" || pathname === "/people/profile";

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

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

  // Refetch when navigating to /people after being away
  useEffect(() => {
    if (pathname === "/people") {
      fetchPeople();
    }
  }, [pathname]);

  // Refetch when page becomes visible (user returns to tab) and we're on the main /people page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && pathname === "/people") {
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

  const handlePeopleIconClick = () => {
    // Check if we're already on a people route
    const isOnPeopleRoute = pathname?.startsWith("/people");
    
    if (isOnPeopleRoute) {
      // Reset to default view
      setSearchQuery("");
      setShowStarredOnly(false);
      setSelectedPerson(null);
      router.push("/people");
    } else {
      // Navigate to people page
      router.push("/people");
    }
  };

  // Show nothing while checking authentication
  if (authLoading || !user) {
    return null;
  }

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
      <div className="flex h-screen bg-white dark:bg-gray-900">
        {/* Left Sidebar */}
        <Sidebar
          ref={sidebarRef}
          people={people}
          selectedPerson={selectedPerson}
          showStarredOnly={showStarredOnly}
          onToggleStarred={() => setShowStarredOnly(!showStarredOnly)}
          onSelectPerson={setSelectedPerson}
          onPeopleIconClick={handlePeopleIconClick}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-gray-900">
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

