"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload, ArrowLeft } from "lucide-react";
import { EmailIntegrations } from "@/components/integrations/EmailIntegrations";

export default function PeopleProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
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
      setUsername(profile.username || "");
      setWebsite(profile.website || "");
      setAvatarUrl(profile.avatar_url || null);
      setSelectedRoles(profile.roles || []);
    }
  }, [profile]);

  // Check for email integration success
  useEffect(() => {
    const success = searchParams.get('success');
    if (success === 'true') {
      setMessage('Email account connected successfully!');
      setTimeout(() => setMessage(null), 5000);
      // Clean up URL
      window.history.replaceState({}, '', '/people/profile');
    }
  }, [searchParams]);

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
          username: username || null,
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

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const initials = fullName ? getInitials(fullName) : (user.email?.split("@")[0]?.substring(0, 2).toUpperCase() || "U");

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-900">
      <div className="max-w-2xl mx-auto w-full px-6 py-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Profile</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage your account information and preferences.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm border border-green-200 dark:border-green-800">
            {message}
          </div>
        )}

        <div className="space-y-8">
          {/* Profile Photo */}
          <div className="flex flex-col gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile photo</label>
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl || undefined} alt={fullName || user.email || ""} />
                <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-lg">
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
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      className="cursor-pointer"
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? "Uploading..." : "Change photo"}
                    </Button>
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  SVG, PNG, JPG or GIF (max. 800x800px)
                </p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Email
              </label>
              <Input
                type="email"
                value={user.email || ""}
                disabled
                className="bg-gray-50 dark:bg-gray-800"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your email address cannot be changed
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Full Name
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter a username"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Must be at least 3 characters
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Website
              </label>
              <Input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Professional Profile Section */}
          <section className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Professional Profile</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select the roles that best describe your involvement in commercial real estate.
              </p>
            </div>

            <div className="flex flex-col gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              {roles.map((role) => (
                <div key={role} className="flex items-center gap-3">
                  <Checkbox
                    id={role}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <label
                    htmlFor={role}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
                  >
                    {role}
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Email & Calendar Integrations */}
          <section className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex flex-col gap-1 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email & Calendar</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect your email and calendar to automatically import and sync your contacts.
              </p>
            </div>
            <EmailIntegrations />
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              {isSaving ? "Saving..." : "Save Changes"}
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
  );
}

