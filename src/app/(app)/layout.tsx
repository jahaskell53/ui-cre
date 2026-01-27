"use client";

import { useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AppSidebar, type AppSidebarRef } from "@/components/layout/app-sidebar";
import { useUser } from "@/hooks/use-user";
import { useEffect } from "react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useUser();
  const sidebarRef = useRef<AppSidebarRef>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Check if current route is a public event page
  const isPublicEventPage = pathname?.startsWith('/events/') && /^\/events\/[^\/]+$/.test(pathname);

  // Redirect to login if not authenticated (only after loading is complete)
  // Skip redirect for public event pages
  useEffect(() => {
    if (!authLoading && !user && !isPublicEventPage) {
      router.push("/login");
    }
  }, [authLoading, user, router, isPublicEventPage]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // If not authenticated and not loading, show nothing (redirect will happen via useEffect)
  // But also render children in case there's a race condition - the middleware will handle redirect
  // Exception: allow public event pages to render without authentication
  if (!user && !isPublicEventPage) {
    return null;
  }

  // For public event pages, render without sidebar
  if (isPublicEventPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Left Sidebar */}
      <AppSidebar
        ref={sidebarRef}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-gray-900 lg:ml-0">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
