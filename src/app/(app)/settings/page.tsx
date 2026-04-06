"use client";

import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";
import { usePageTour } from "@/hooks/use-page-tour";
import { cn } from "@/lib/utils";

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
            <path
                d="M8 2V4M8 12V14M4 8H2M14 8H12M12.364 3.636L10.95 5.05M5.05 10.95L3.636 12.364M12.364 12.364L10.95 10.95M5.05 5.05L3.636 3.636M11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ArrowRightIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push("/")}
                        className="-ml-1.5 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <BackIcon className="h-5 w-5" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                <div className="mx-auto max-w-2xl p-6">
                    <div className="space-y-6">
                        {/* Appearance Section */}
                        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-6 flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Customize how the application looks for you.</p>
                            </div>

                            <div className="flex flex-col gap-4">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Interface theme</label>
                                {mounted && (
                                    <div data-tour="theme-toggle" className="flex max-w-xs rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                                        <button
                                            onClick={() => setTheme("light")}
                                            className={cn(
                                                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                                                currentTheme === "light"
                                                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
                                            )}
                                        >
                                            <SunIcon className="h-4 w-4" />
                                            Light
                                        </button>
                                        <button
                                            onClick={() => setTheme("dark")}
                                            className={cn(
                                                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                                                currentTheme === "dark"
                                                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                                                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
                                            )}
                                        >
                                            <Moon className="h-4 w-4" />
                                            Dark
                                        </button>
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400">Choose between light and dark mode.</p>
                            </div>
                        </div>

                        {/* Newsletter Preferences Section */}
                        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-6 flex flex-col gap-1">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Newsletter</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Manage your CRE news feed and email newsletter preferences.</p>
                            </div>

                            <Link
                                href="/news/settings"
                                data-tour="newsletter-settings"
                                className="group flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                            >
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Newsletter Preferences</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Customize your news feed, location preferences, and delivery schedule
                                    </span>
                                </div>
                                <ArrowRightIcon className="h-4 w-4 text-gray-400 transition-colors group-hover:text-gray-600 dark:group-hover:text-gray-300" />
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
