"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar, type AppSidebarRef } from "@/components/layout/app-sidebar";
import { useUser } from "@/hooks/use-user";
import { useEffect } from "react";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const sidebarRef = useRef<AppSidebarRef>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Show nothing while checking authentication
  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Left Sidebar */}
      <AppSidebar
        ref={sidebarRef}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-gray-900">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
