"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, File, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { generateAuroraGradient } from "@/app/(app)/network/utils";

interface CreatePostInlineProps {
    onSuccess: () => void;
    userId: string;
    isAdmin: boolean;
    userAvatarUrl: string | null;
    userFullName: string | null;
}

export const CreatePostInline = ({ onSuccess, userId, isAdmin, userAvatarUrl, userFullName }: CreatePostInlineProps) => {
    const [postType, setPostType] = useState<"post" | "link">("post");
    const [postContent, setPostContent] = useState("");
    const [postUrl, setPostUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attachedFileUrl, setAttachedFileUrl] = useState<string | null>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [postAsSystem, setPostAsSystem] = useState(false);
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

    const getInitials = (name: string | null) => {
        if (!name) return "U";
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

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
            setIsExpanded(false);
            onSuccess();
        }
        setIsSubmitting(false);
    };

    const displayName = userFullName || "User";
    const initials = getInitials(userFullName);

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <div className="flex gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={userAvatarUrl || undefined} />
                    <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-xs text-white font-medium">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex flex-col gap-3">
                    {!isExpanded ? (
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="text-left px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            What's on your mind?
                        </button>
                    ) : (
                        <>
                            {isAdmin && (
                                <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50">
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
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPostType("post")}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        postType === "post"
                                            ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                    }`}
                                >
                                    Post
                                </button>
                                <button
                                    onClick={() => setPostType("link")}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        postType === "link"
                                            ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
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
                                    className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                />
                            ) : (
                                <Textarea
                                    ref={inputRef}
                                    placeholder="Share your thoughts with the community..."
                                    value={postContent}
                                    onChange={(e) => setPostContent(e.target.value)}
                                    rows={4}
                                    className="resize-none bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                />
                            )}
                            {attachedFileUrl && (
                                <div className="relative w-32 h-32 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden group bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center p-2">
                                    {attachedFileUrl.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                                        <img src={attachedFileUrl} className="w-full h-full object-cover rounded-md" alt="Attachment" />
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
                            )}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={isUploadingFile}
                                    />
                                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
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
                                            setPostContent("");
                                            setPostUrl("");
                                            setAttachedFileUrl(null);
                                            setPostType("post");
                                            setPostAsSystem(false);
                                        }}
                                        className="text-gray-600 dark:text-gray-400"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCreatePost}
                                        disabled={isSubmitting || (postType === "link" ? !postUrl.trim() : !postContent.trim())}
                                        size="sm"
                                        className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
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
