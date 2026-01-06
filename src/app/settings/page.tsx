"use client";

import { MainLayout } from "@/components/layout/main-layout";
import { ThemeToggle } from "@/components/application/app-navigation/base-components/theme-toggle";

    return (
        <MainLayout>
            <div className="max-w-2xl pb-20">
                <h1 className="text-display-sm font-semibold text-primary mb-2">Settings</h1>
                <p className="text-lg text-tertiary mb-8">Manage your account preferences and professional profile.</p>

                <div className="space-y-8">
                    {/* Appearance Section */}
                    <section className="bg-primary border border-secondary rounded-2xl p-6 shadow-xs">
                        <div className="flex flex-col gap-1 mb-6">
                            <h2 className="text-lg font-semibold text-primary">Appearance</h2>
                            <p className="text-sm text-tertiary">Customize how the application looks for you.</p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <label className="text-sm font-medium text-secondary">Interface theme</label>
                            <div className="max-w-xs">
                                <ThemeToggle />
                            </div>
                            <p className="text-xs text-tertiary">Choose between light and dark mode.</p>
                        </div>
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
