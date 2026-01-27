"use client";

import { useState, useEffect } from "react";
import { usePageTour } from "@/hooks/use-page-tour";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload, Trash2 } from "lucide-react";
import { EmailIntegrations } from "@/components/integrations/EmailIntegrations";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { GuidedTour, type TourStep } from "@/components/ui/guided-tour";
import { ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Listen for tour trigger from sidebar
  usePageTour(() => setIsTourOpen(true));

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

  // Check for email integration success
  useEffect(() => {
    const success = searchParams.get('success');
    if (success === 'true') {
      setMessage('Email account connected successfully!');
      setTimeout(() => setMessage(null), 5000);
      // Clean up URL
      window.history.replaceState({}, '', '/profile');
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

  const handleRemoveAvatar = async () => {
    setIsUploading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(null);
      setMessage("Profile photo removed successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to remove profile photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      // Sign out and redirect to login
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Failed to delete account");
      setIsDeleting(false);
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

  const tourSteps: TourStep[] = [
    {
      id: "avatar",
      target: '[data-tour="avatar-upload"]',
      title: "Upload Profile Photo",
      content: "Click here to upload a profile photo. Your photo will be visible to other users in the network.",
      position: "bottom",
    },
    {
      id: "profile-info",
      target: '[data-tour="profile-info"]',
      title: "Edit Profile Information",
      content: "Update your name, website, and roles. These details help others understand your role in the industry.",
      position: "bottom",
    },
    {
      id: "email-integration",
      target: '[data-tour="email-integration"]',
      title: "Connect Email",
      content: "Connect your email account to automatically sync contacts and interactions with your network.",
      position: "top",
    },
  ];

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Navigation Bar */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto p-6">
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
                  <AvatarFallback
                    className="text-white text-lg font-medium"
                    style={{ background: generateAuroraGradient(fullName || user.email || "User") }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-3">
                    <label data-tour="avatar-upload" className="cursor-pointer">
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
                        onClick={handleRemoveAvatar}
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
            <div data-tour="profile-info" className="space-y-6">
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
              <div data-tour="email-integration">
                <EmailIntegrations />
              </div>
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
                onClick={() => router.push("/")}
              >
                Cancel
              </Button>
            </div>

            {/* Danger Zone */}
            <section className="border-t border-gray-200 dark:border-gray-800 pt-8 mt-8">
              <div className="flex flex-col gap-1 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Danger Zone</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteModal(true)}
                className="w-fit"
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </Button>
            </section>
          </div>
        </div>
      </div>

      {/* Guided Tour */}
      <GuidedTour
        steps={tourSteps}
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onComplete={() => {
          console.log("Profile tour completed!");
        }}
      />

      {/* Delete Account Confirmation Modal */}
      <ModalOverlay
        isOpen={showDeleteModal}
        onOpenChange={(isOpen) => !isOpen && setShowDeleteModal(false)}
      >
        <Modal className="max-w-md bg-white dark:bg-gray-900 shadow-xl rounded-xl border border-gray-200 dark:border-gray-800">
          <Dialog className="p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-center mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Account?</h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}
