"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePageTour } from "@/hooks/use-page-tour";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Moon } from "lucide-react";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2V4M8 12V14M4 8H2M14 8H12M12.364 3.636L10.95 5.05M5.05 10.95L3.636 12.364M12.364 12.364L10.95 10.95M5.05 5.05L3.636 3.636M11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}


function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Listen for tour trigger from sidebar
  usePageTour(() => setIsTourOpen(true));

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === "system" ? "light" : theme;

  const tourSteps: TourStep[] = [
    {
      id: "theme",
      target: '[data-tour="theme-toggle"]',
      title: "Change Theme",
      content: "Switch between light and dark mode to customize your viewing experience.",
      position: "bottom",
    },
    {
      id: "newsletter",
      target: '[data-tour="newsletter-settings"]',
      title: "Newsletter Preferences",
      content: "Manage your CRE news feed preferences, including location interests and delivery schedule.",
      position: "bottom",
    },
  ];

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto p-6">
          <div className="space-y-6">
            {/* Appearance Section */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex flex-col gap-1 mb-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Customize how the application looks for you.</p>
              </div>

              <div className="flex flex-col gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Interface theme</label>
                {mounted && (
                  <div data-tour="theme-toggle" className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg max-w-xs">
                    <button
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                        currentTheme === "light"
                          ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      )}
                    >
                      <SunIcon className="w-4 h-4" />
                      Light
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all",
                        currentTheme === "dark"
                          ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      )}
                    >
                      <Moon className="w-4 h-4" />
                      Dark
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">Choose between light and dark mode.</p>
              </div>
            </div>

            {/* Newsletter Preferences Section */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex flex-col gap-1 mb-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Newsletter</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage your CRE news feed and email newsletter preferences.</p>
              </div>

              <Link
                href="/news/settings"
                data-tour="newsletter-settings"
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Newsletter Preferences</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Customize your news feed, location preferences, and delivery schedule</span>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Guided Tour */}
      <GuidedTour
        steps={tourSteps}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onComplete={() => {
          console.log("Settings tour completed!");
        }}
      />
    </div>
  );
}
