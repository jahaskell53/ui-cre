"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { Avatar } from "@/components/base/avatar/avatar";
import { Upload01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile, loading } = useUser();
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [fullName, setFullName] = useState("");
    const [website, setWebsite] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

    const roles = ["Property Owner", "Broker", "Lender"];

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [loading, user, router]);

    // Update form when profile loads
    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || "");
            setWebsite(profile.website || "");
            setAvatarUrl(profile.avatar_url || null);
            setSelectedRoles(profile.roles || []);
        }
    }, [profile]);

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-tertiary">Loading...</div>
                </div>
            </MainLayout>
        );
    }

    if (!user) {
        return null;
    }

    const toggleRole = (role: string) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setMessage(null);

        try {
            const { error: updateError } = await supabase
                .from("profiles")
                .update({
                    full_name: fullName || null,
                    website: website || null,
                    avatar_url: avatarUrl,
                    roles: selectedRoles,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

            if (updateError) throw updateError;

            setMessage("Profile updated successfully!");
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to update profile");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to upload image");
            }

            setAvatarUrl(data.url);
            setMessage("Photo uploaded! Click Save Changes to apply.");
        } catch (err: any) {
            setError(err.message || "Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <MainLayout>
            <div className="max-w-2xl">
                <h1 className="text-display-sm font-semibold text-primary mb-2">Profile</h1>
                <p className="text-lg text-tertiary mb-8">Manage your account information and preferences.</p>

                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-error-primary/10 text-error-primary text-sm">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mb-6 p-4 rounded-lg bg-brand-primary/10 text-brand-primary text-sm">
                        {message}
                    </div>
                )}

                <div className="space-y-8">
                    <div className="flex flex-col gap-4">
                        <label className="text-sm font-medium text-secondary">Profile photo</label>
                        <div className="flex items-center gap-6">
                            <Avatar
                                size="2xl"
                                src={avatarUrl}
                                initials={fullName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U"}
                            />
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-3">
                                    <label className="cursor-pointer">
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleAvatarUpload}
                                            disabled={isUploading}
                                        />
                                        <div className="inline-flex items-center justify-center gap-2 rounded-lg border border-secondary bg-primary px-4 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-secondary disabled:opacity-50 transition-colors">
                                            {isUploading ? "Uploading..." : "Change photo"}
                                        </div>
                                    </label>
                                    {avatarUrl && (
                                        <Button
                                            color="secondary"
                                            size="sm"
                                            onClick={() => setAvatarUrl(null)}
                                            isDisabled={isUploading}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs text-tertiary">SVG, PNG, JPG or GIF (max. 800x800px)</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <Input
                                label="Email"
                                value={user.email || ""}
                                isDisabled
                                hint="Your email address cannot be changed"
                            />
                        </div>

                        <div>
                            <Input
                                label="Full Name"
                                value={fullName}
                                onChange={setFullName}
                                placeholder="Enter your full name"
                            />
                        </div>

                        <div>
                            <Input
                                label="Website"
                                value={website}
                                onChange={setWebsite}
                                placeholder="https://example.com"
                                type="url"
                            />
                        </div>
                    </div>

                    {/* Professional Profile Section */}
                    <section className="bg-primary border border-secondary rounded-2xl p-6 shadow-xs">
                        <div className="flex flex-col gap-1 mb-6">
                            <h2 className="text-lg font-semibold text-primary">Professional Profile</h2>
                            <p className="text-sm text-tertiary">Select the roles that best describe your involvement in commercial real estate.</p>
                        </div>

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
                    </section>

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleSave}
                            isLoading={isSaving}
                        >
                            Save Changes
                        </Button>
                        <Button
                            color="secondary"
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
