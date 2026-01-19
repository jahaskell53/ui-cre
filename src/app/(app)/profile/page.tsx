"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Loader2 } from "lucide-react";
import { generateAuroraGradient } from "@/app/people/utils";

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
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
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

    const initials = fullName?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";

    return (
        <div className="flex flex-col h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="flex flex-col gap-8 p-6">
                <div className="max-w-2xl w-full">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Profile</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Manage your account information and preferences.</p>

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
                        <Label>Profile photo</Label>
                        <div className="flex items-center gap-6">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={avatarUrl || undefined} />
                                <AvatarFallback style={{ background: generateAuroraGradient(fullName || "User") }} className="text-xl text-white">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
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
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setAvatarUrl(null)}
                                            disabled={isUploading}
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
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                value={user.email || ""}
                                disabled
                            />
                            <p className="text-xs text-tertiary">Your email address cannot be changed</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Website</Label>
                            <Input
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
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
                                <div key={role} className="flex items-center gap-2">
                                    <Checkbox
                                        id={role}
                                        checked={selectedRoles.includes(role)}
                                        onCheckedChange={() => toggleRole(role)}
                                    />
                                    <Label htmlFor={role} className="text-sm font-normal cursor-pointer">
                                        {role}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving && <Loader2 className="size-4 animate-spin" />}
                            Save Changes
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
