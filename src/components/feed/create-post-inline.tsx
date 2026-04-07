"use client";

import { useEffect, useRef, useState } from "react";
import { File, Image as ImageIcon, Loader2, X } from "lucide-react";
import { generateAuroraGradient } from "@/app/(app)/network/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    DEFAULT_FEED_POST_DRAFT,
    canSubmitFeedPost,
    getAttachmentDisplayName,
    getFeedInitials,
    getFeedPostContent,
    isImageAttachment,
    resolvePostAuthorId,
    uploadPostAttachment,
} from "@/lib/feed/create-post";
import { supabase } from "@/utils/supabase";

interface CreatePostInlineProps {
    onSuccess: () => void;
    userId: string;
    isAdmin: boolean;
    userAvatarUrl: string | null;
    userFullName: string | null;
}

export const CreatePostInline = ({ onSuccess, userId, isAdmin, userAvatarUrl, userFullName }: CreatePostInlineProps) => {
    const [postType, setPostType] = useState<"post" | "link">(DEFAULT_FEED_POST_DRAFT.postType);
    const [postContent, setPostContent] = useState(DEFAULT_FEED_POST_DRAFT.postContent);
    const [postUrl, setPostUrl] = useState(DEFAULT_FEED_POST_DRAFT.postUrl);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attachedFileUrl, setAttachedFileUrl] = useState<string | null>(DEFAULT_FEED_POST_DRAFT.attachedFileUrl);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [postAsSystem, setPostAsSystem] = useState(DEFAULT_FEED_POST_DRAFT.postAsSystem);
    const [isExpanded, setIsExpanded] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const urlInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isExpanded) {
            // Small delay to ensure the input is rendered
            setTimeout(() => {
                if (postType === "link" && urlInputRef.current) {
                    urlInputRef.current.focus();
                } else if (postType === "post" && inputRef.current) {
                    inputRef.current.focus();
                }
            }, 0);
        }
    }, [isExpanded, postType]);

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
            setIsExpanded(false);
            onSuccess();
        }
        setIsSubmitting(false);
    };

    const displayName = userFullName || "User";
    const initials = getFeedInitials(userFullName);

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={userAvatarUrl || undefined} />
                    <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs font-medium text-white">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col gap-3">
                    {!isExpanded ? (
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-left text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        >
                            What's on your mind?
                        </button>
                    ) : (
                        <>
                            {isAdmin && (
                                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
                                    <div className="flex flex-col gap-1">
                                        <Label htmlFor="post-as-system" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            Post as OpenMidmarket
                                        </Label>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Post on behalf of the system account</span>
                                    </div>
                                    <Switch id="post-as-system" checked={postAsSystem} onCheckedChange={setPostAsSystem} />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPostType("post")}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        postType === "post"
                                            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                            : "border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    Post
                                </button>
                                <button
                                    onClick={() => setPostType("link")}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        postType === "link"
                                            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                                            : "border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    Link
                                </button>
                            </div>
                            {postType === "link" ? (
                                <Input
                                    ref={urlInputRef}
                                    placeholder="https://example.com"
                                    value={postUrl}
                                    onChange={(e) => setPostUrl(e.target.value)}
                                    className="border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                                />
                            ) : (
                                <Textarea
                                    ref={inputRef}
                                    placeholder="Share your thoughts with the community..."
                                    value={postContent}
                                    onChange={(e) => setPostContent(e.target.value)}
                                    rows={4}
                                    className="resize-none border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                                />
                            )}
                            {attachedFileUrl && (
                                <div className="group relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-800/50">
                                    {isImageAttachment(attachedFileUrl) ? (
                                        <img src={attachedFileUrl} className="h-full w-full rounded-md object-cover" alt="Attachment" />
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
                            )}
                            <div className="flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-800">
                                <label className="cursor-pointer">
                                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploadingFile} />
                                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                                        {isUploadingFile ? (
                                            <>
                                                <Loader2 className="size-4 animate-spin" />
                                                <span>Uploading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon className="size-4" />
                                                <span>Photo</span>
                                            </>
                                        )}
                                    </div>
                                </label>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setIsExpanded(false);
                                            setPostContent(DEFAULT_FEED_POST_DRAFT.postContent);
                                            setPostUrl(DEFAULT_FEED_POST_DRAFT.postUrl);
                                            setAttachedFileUrl(DEFAULT_FEED_POST_DRAFT.attachedFileUrl);
                                            setPostType(DEFAULT_FEED_POST_DRAFT.postType);
                                            setPostAsSystem(DEFAULT_FEED_POST_DRAFT.postAsSystem);
                                        }}
                                        className="text-gray-600 dark:text-gray-400"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreatePost}
                                        disabled={isSubmitting || !canSubmitFeedPost(postType, postContent, postUrl)}
                                        size="sm"
                                        className="bg-gray-900 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                                    >
                                        {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                                        Post
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
