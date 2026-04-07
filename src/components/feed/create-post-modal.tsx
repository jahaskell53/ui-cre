"use client";

import { useState } from "react";
import { File, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    DEFAULT_FEED_POST_DRAFT,
    canSubmitFeedPost,
    getAttachmentDisplayName,
    getFeedPostContent,
    isImageAttachment,
    resolvePostAuthorId,
    uploadPostAttachment,
} from "@/lib/feed/create-post";
import { supabase } from "@/utils/supabase";

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
    isAdmin: boolean;
}

export const CreatePostModal = ({ isOpen, onClose, onSuccess, userId, isAdmin }: CreatePostModalProps) => {
    const [postType, setPostType] = useState<"post" | "link">(DEFAULT_FEED_POST_DRAFT.postType);
    const [postContent, setPostContent] = useState(DEFAULT_FEED_POST_DRAFT.postContent);
    const [postUrl, setPostUrl] = useState(DEFAULT_FEED_POST_DRAFT.postUrl);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attachedFileUrl, setAttachedFileUrl] = useState<string | null>(DEFAULT_FEED_POST_DRAFT.attachedFileUrl);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [postAsSystem, setPostAsSystem] = useState(DEFAULT_FEED_POST_DRAFT.postAsSystem);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingFile(true);
        const result = await uploadPostAttachment(file, (formData) =>
            fetch("/api/upload", {
                method: "POST",
                body: formData,
            }),
        );
        if (result.url) {
            setAttachedFileUrl(result.url);
        } else if (result.error) {
            alert(result.error);
        }
        setIsUploadingFile(false);
    };

    const handleCreatePost = async () => {
        if (!canSubmitFeedPost(postType, postContent, postUrl)) return;

        setIsSubmitting(true);

        const { userIdToUse, fellBackToUser } = await resolvePostAuthorId({
            userId,
            isAdmin,
            postAsSystem,
            lookupSystemProfileId: async () => {
                const { data: systemProfile, error: systemError } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("full_name", "OpenMidmarket") // pragma: allowlist secret
                    .single();
                if (systemError || !systemProfile) {
                    console.error("Error fetching system account:", systemError);
                    return null;
                }
                return systemProfile.id;
            },
        });

        if (fellBackToUser) {
            alert("Failed to find system account. Posting as yourself.");
        }

        const { error } = await supabase.from("posts").insert({
            user_id: userIdToUse,
            type: postType,
            content: getFeedPostContent(postType, postContent, postUrl),
            file_url: attachedFileUrl,
        });

        if (!error) {
            setPostContent(DEFAULT_FEED_POST_DRAFT.postContent);
            setPostUrl(DEFAULT_FEED_POST_DRAFT.postUrl);
            setAttachedFileUrl(DEFAULT_FEED_POST_DRAFT.attachedFileUrl);
            setPostType(DEFAULT_FEED_POST_DRAFT.postType);
            setPostAsSystem(DEFAULT_FEED_POST_DRAFT.postAsSystem);
            onSuccess();
            onClose();
        }
        setIsSubmitting(false);
    };

    const handleClose = () => {
        setPostContent(DEFAULT_FEED_POST_DRAFT.postContent);
        setPostUrl(DEFAULT_FEED_POST_DRAFT.postUrl);
        setAttachedFileUrl(DEFAULT_FEED_POST_DRAFT.attachedFileUrl);
        setPostType(DEFAULT_FEED_POST_DRAFT.postType);
        setPostAsSystem(DEFAULT_FEED_POST_DRAFT.postAsSystem);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create new post</DialogTitle>
                </DialogHeader>

                <div className="flex w-full flex-col gap-6">
                    {isAdmin && (
                        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                            <div className="flex flex-col gap-1">
                                <Label htmlFor="post-as-system" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    Post as OpenMidmarket
                                </Label>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Post on behalf of the system account</span>
                            </div>
                            <Switch id="post-as-system" checked={postAsSystem} onCheckedChange={setPostAsSystem} />
                        </div>
                    )}
                    <div className="flex flex-col gap-3">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select post type</Label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPostType("post")}
                                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors lg:flex-none ${
                                    postType === "post"
                                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                        : "border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                                }`}
                            >
                                Post
                            </button>
                            <button
                                onClick={() => setPostType("link")}
                                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors lg:flex-none ${
                                    postType === "link"
                                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                        : "border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                                }`}
                            >
                                Link
                            </button>
                        </div>
                    </div>
                    {postType === "link" && (
                        <div className="space-y-2 duration-200 animate-in fade-in">
                            <Label htmlFor="url-input">URL</Label>
                            <Input id="url-input" placeholder="https://example.com" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} />
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
                                <div className="group relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-800/50">
                                    {isImageAttachment(attachedFileUrl) ? (
                                        <img src={attachedFileUrl} className="h-full w-full rounded-md object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-center">
                                            <File className="size-8 text-gray-400 dark:text-gray-500" />
                                            <span className="w-24 truncate text-[10px] font-medium text-gray-600 dark:text-gray-400">
                                                {getAttachmentDisplayName(attachedFileUrl)}
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setAttachedFileUrl(null)}
                                        className="absolute top-1 right-1 rounded-full bg-white p-1 text-gray-500 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:bg-gray-900 dark:text-gray-400"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer">
                                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploadingFile} />
                                    <div className="flex h-32 w-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600">
                                        {isUploadingFile ? (
                                            <div className="animate-pulse text-xs text-gray-500 dark:text-gray-400">Uploading...</div>
                                        ) : (
                                            <>
                                                <File className="mb-2 size-6 text-gray-400 dark:text-gray-500" />
                                                <span className="text-xs text-gray-500 dark:text-gray-400">Add file</span>
                                            </>
                                        )}
                                    </div>
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col-reverse justify-end gap-2 border-t border-gray-200 pt-4 sm:flex-row dark:border-gray-800">
                    <button
                        onClick={handleClose}
                        className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 sm:flex-none dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreatePost}
                        disabled={isSubmitting || !canSubmitFeedPost(postType, postContent, postUrl)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                        Share
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
