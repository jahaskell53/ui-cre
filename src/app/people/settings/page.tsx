"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import AccountCard from "../account-card";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 13.5H12M8.18 1.764L2.43 6.204C2.01 6.522 1.8 6.681 1.647 6.878C1.51 7.053 1.408 7.252 1.347 7.464C1.278 7.703 1.278 7.961 1.278 8.478V13.02C1.278 13.948 1.278 14.412 1.459 14.77C1.618 15.084 1.872 15.338 2.186 15.497C2.544 15.678 3.008 15.678 3.936 15.678H14.064C14.992 15.678 15.456 15.678 15.814 15.497C16.128 15.338 16.382 15.084 16.541 14.77C16.722 14.412 16.722 13.948 16.722 13.02V8.478C16.722 7.961 16.722 7.703 16.653 7.464C16.592 7.252 16.49 7.053 16.353 6.878C16.2 6.681 15.99 6.522 15.57 6.204L9.82 1.764C9.496 1.52 9.334 1.398 9.156 1.352C8.999 1.312 8.834 1.312 8.677 1.352C8.499 1.398 8.337 1.52 8.013 1.764L8.18 1.764Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 15.75C15 14.5074 15 13.8861 14.8463 13.3836C14.4921 12.2271 13.5229 11.3079 12.3036 10.9687C11.7748 10.8225 11.1178 10.8225 9.80385 10.8225H8.19615C6.88225 10.8225 6.2253 10.8225 5.6964 10.9687C4.4771 11.3079 3.5079 12.2271 3.1537 13.3836C3 13.8861 3 14.5074 3 15.75M12.375 5.625C12.375 7.48896 10.864 9 9 9C7.13604 9 5.625 7.48896 5.625 5.625C5.625 3.76104 7.13604 2.25 9 2.25C10.864 2.25 12.375 3.76104 12.375 5.625Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.5 9.5C12.6304 10.3696 11.4746 10.8333 10.25 10.8333C8.02537 10.8333 6.25 9.05793 6.25 6.83333C6.25 5.60875 6.71375 4.45292 7.58333 3.58333C6.5 3.58333 5.5 4.08333 4.75 4.83333C3.16667 6.41667 3.16667 8.91667 4.75 10.5C6.33333 12.0833 8.83333 12.0833 10.4167 10.5C11.1667 9.75 11.6667 8.75 11.6667 7.66667C11.6667 8.83333 11.1667 9.83333 10.4167 10.5833L13.5 9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function PeopleSettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === "system" ? "light" : theme;

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Left Sidebar */}
      <div className="w-[180px] border-r border-gray-200 dark:border-gray-800 flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900">
        {/* Logo */}
        <div className="p-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
            <span className="text-white dark:text-gray-900 text-xs font-bold">OM</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">OM</span>
        </div>

        {/* My Workspace */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
            <div className="w-4 h-4 bg-emerald-500 rounded" />
            <span className="text-sm text-gray-700 dark:text-gray-300">My Workspace</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-2 space-y-0.5">
          <div 
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-600 dark:text-gray-400"
            onClick={() => router.push('/people')}
          >
            <HomeIcon className="w-4 h-4" />
            <span className="text-sm">Home</span>
          </div>
          <div 
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-600 dark:text-gray-400"
            onClick={() => router.push('/people')}
          >
            <PeopleIcon className="w-4 h-4" />
            <span className="text-sm">People</span>
          </div>
        </nav>

        {/* Account Card */}
        <div className="mt-auto border-t border-gray-200 dark:border-gray-800 p-3">
          <AccountCard />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-gray-900">
        <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
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
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg max-w-xs">
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
                        <MoonIcon className="w-4 h-4" />
                        Dark
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">Choose between light and dark mode.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

