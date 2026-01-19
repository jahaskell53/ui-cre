"use client";

import { ThemeToggle } from "@/components/application/app-navigation/base-components/theme-toggle";

export default function SettingsPage() {
    return (
        <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6">
                <div className="max-w-2xl w-full pb-20">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Settings</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Manage your account preferences and professional profile.</p>

                    <div className="space-y-8">
                        {/* Appearance Section */}
                        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                            <div className="flex flex-col gap-1 mb-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Customize how the application looks for you.</p>
                            </div>

                            <div className="flex flex-col gap-4">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Interface theme</label>
                                <div className="max-w-xs">
                                    <ThemeToggle />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Choose between light and dark mode.</p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
