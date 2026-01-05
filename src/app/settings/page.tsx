"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { ThemeToggle } from "@/components/application/app-navigation/base-components/theme-toggle";
import { useUser } from "@/hooks/use-user";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Button } from "@/components/base/buttons/button";
import { supabase } from "@/utils/supabase";
import { cx } from "@/utils/cx";

export default function SettingsPage() {
    const { user, profile } = useUser();
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const roles = ["Property Owner", "Broker", "Lender"];

    useEffect(() => {
        if (profile?.roles) {
            setSelectedRoles(profile.roles);
        } else if (user?.user_metadata?.roles) {
            setSelectedRoles(user.user_metadata.roles);
        }
    }, [profile, user]);

    const toggleRole = (role: string) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        setSaveMessage(null);

        const { error } = await supabase
            .from("profiles")
            .update({ roles: selectedRoles })
            .eq("id", user.id);

        if (error) {
            console.error("Error updating roles:", error);
            setSaveMessage("Failed to save changes.");
        } else {
            setSaveMessage("Profile updated successfully!");
        }
        setIsSaving(false);
    };

    return (
        <MainLayout>
            <div className="max-w-2xl pb-20">
                <h1 className="text-display-sm font-semibold text-primary mb-2">Settings</h1>
                <p className="text-lg text-tertiary mb-8">Manage your account preferences and professional profile.</p>

                <div className="space-y-8">
                    {/* User Roles Section */}
                    <section className="bg-primary border border-secondary rounded-2xl p-6 shadow-xs">
                        <div className="flex flex-col gap-1 mb-6">
                            <h2 className="text-lg font-semibold text-primary">Professional Profile</h2>
                            <p className="text-sm text-tertiary">Select the roles that best describe your involvement in commercial real estate.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex flex-col gap-3 p-4 border border-secondary rounded-xl bg-secondary/5">
                                {roles.map((role) => (
                                    <Checkbox
                                        key={role}
                                        label={role}
                                        isSelected={selectedRoles.includes(role)}
                                        onChange={() => toggleRole(role)}
                                    />
                                ))}
                            </div>

                            <div className="flex items-center gap-4">
                                <Button onClick={handleSave} isLoading={isSaving} size="md">
                                    Save Profile
                                </Button>
                                {saveMessage && (
                                    <p className={cx(
                                        "text-sm font-medium",
                                        saveMessage.includes("success") ? "text-success-700" : "text-error-700"
                                    )}>
                                        {saveMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>

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
