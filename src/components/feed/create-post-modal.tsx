"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { X, File, Loader2 } from "lucide-react";
import { supabase } from "@/utils/supabase";

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    isAdmin: boolean;
}

export const CreatePostModal = ({ isOpen, onClose, onSuccess, userId, isAdmin }: CreatePostModalProps) => {
    const [postType, setPostType] = useState<"post" | "link">("post");
    const [postContent, setPostContent] = useState("");
    const [postUrl, setPostUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attachedFileUrl, setAttachedFileUrl] = useState<string | null>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [postAsSystem, setPostAsSystem] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingFile(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                setAttachedFileUrl(data.url);
            } else {
                alert(data.error || "Failed to upload file");
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Failed to upload file");
        } finally {
            setIsUploadingFile(false);
        }
    };

    const handleCreatePost = async () => {
        if (postType !== "link" && !postContent.trim()) return;
        if (postType === "link" && !postUrl.trim()) return;

        setIsSubmitting(true);

        let userIdToUse = userId;

        if (postAsSystem && isAdmin) {
            const { data: systemProfile, error: systemError } = await supabase
                .from("profiles")
                .select("id")
                .eq("full_name", "OpenMidmarket")
                .single();

            if (!systemError && systemProfile) {
                userIdToUse = systemProfile.id;
            } else {
                console.error("Error fetching system account:", systemError);
                alert("Failed to find system account. Posting as yourself.");
            }
        }

        const { error } = await supabase
            .from("posts")
            .insert({
                user_id: userIdToUse,
                type: postType,
                content: postType === "link" ? postUrl.trim() : postContent.trim(),
                file_url: attachedFileUrl,
            });

        if (!error) {
            setPostContent("");
            setPostUrl("");
            setAttachedFileUrl(null);
            setPostType("post");
            setPostAsSystem(false);
            onSuccess();
            onClose();
        }
        setIsSubmitting(false);
    };

    const handleClose = () => {
        setPostContent("");
        setPostUrl("");
        setAttachedFileUrl(null);
        setPostType("post");
        setPostAsSystem(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create new post</DialogTitle>
                </DialogHeader>

                <div className="w-full flex flex-col gap-6">
                    {isAdmin && (
                        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="post-as-system" className="text-sm font-medium text-gray-900 dark:text-gray-100">Post as OpenMidmarket</Label>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Post on behalf of the system account</span>
                            </div>
                            <Switch
                                id="post-as-system"
                                checked={postAsSystem}
                                onCheckedChange={setPostAsSystem}
                            />
                        </div>
                    )}
                    <div className="flex flex-col gap-3">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select post type</Label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPostType("post")}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex-1 lg:flex-none ${
                                    postType === "post"
                                        ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                }`}
                            >
                                Post
                            </button>
                            <button
                                onClick={() => setPostType("link")}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex-1 lg:flex-none ${
                                    postType === "link"
                                        ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                }`}
                            >
                                Link
                            </button>
                        </div>
                    </div>
                    {postType === "link" && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                            <Label htmlFor="url-input">URL</Label>
                            <Input
                                id="url-input"
                                placeholder="https://example.com"
                                value={postUrl}
                                onChange={(e) => setPostUrl(e.target.value)}
                            />
                        </div>
                    )}

                    {postType !== "link" && (
                        <div className="space-y-2">
                            <Label htmlFor="content-input">What's on your mind?</Label>
                            <Textarea
                                id="content-input"
                                placeholder="Share your thoughts with the community..."
                                value={postContent}
                                onChange={(e) => setPostContent(e.target.value)}
                                rows={4}
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Attachments</Label>
                        <div className="flex flex-wrap gap-3">
                            {attachedFileUrl ? (
                                <div className="relative w-32 h-32 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden group bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center p-2">
                                    {attachedFileUrl.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                                        <img src={attachedFileUrl} className="w-full h-full object-cover rounded-md" />
                                    ) : (
                                        <div className="flex flex-col items-center text-center gap-1">
                                            <File className="size-8 text-gray-400 dark:text-gray-500" />
                                            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate w-24">
                                                {decodeURIComponent(attachedFileUrl.split('/').pop()?.split('-').slice(1).join('-') || "File")}
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setAttachedFileUrl(null)}
                                        className="absolute top-1 right-1 p-1 bg-white dark:bg-gray-900 rounded-full text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={isUploadingFile}
                                    />
                                    <div className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-gray-50 dark:bg-gray-800/50">
                                        {isUploadingFile ? (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">Uploading...</div>
                                        ) : (
                                            <>
                                                <File className="size-6 text-gray-400 dark:text-gray-500 mb-2" />
                                                <span className="text-xs text-gray-500 dark:text-gray-400">Add file</span>
                                            </>
                                        )}
                                    </div>
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <button
                        onClick={handleClose}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md transition-colors flex-1 sm:flex-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreatePost}
                        disabled={isSubmitting || (postType === "link" ? !postUrl.trim() : !postContent.trim())}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded-md transition-colors flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                        Share
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
