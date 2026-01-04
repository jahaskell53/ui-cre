"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";

export default function ProfilePage() {
    const router = useRouter();
    const { user, profile, loading } = useUser();
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [website, setWebsite] = useState("");

    // Update form when profile loads
    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || "");
            setUsername(profile.username || "");
            setWebsite(profile.website || "");
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
        router.push("/login");
        return null;
    }

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setMessage(null);

        try {
            const { error: updateError } = await supabase
                .from("profiles")
                .update({
                    full_name: fullName || null,
                    username: username || null,
                    website: website || null,
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
                            label="Username"
                            value={username}
                            onChange={setUsername}
                            placeholder="Enter a username"
                            hint="Must be at least 3 characters"
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
