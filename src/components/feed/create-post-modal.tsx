"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { Toggle } from "@/components/base/toggle/toggle";
import { X, File02 } from "@untitledui/icons";
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

    const handleCreatePost = async (close?: () => void) => {
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
            close?.();
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
        <ModalOverlay isOpen={isOpen} onOpenChange={onClose}>
            <Modal>
                <Dialog className="w-full max-w-6xl mx-auto bg-primary rounded-xl shadow-lg p-6">
                    {({ close }) => (
                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between border-b border-secondary pb-4 -mx-6 px-6 mb-2">
                                <h2 className="text-lg font-semibold text-primary">Create new post</h2>
                                <Button
                                    color="tertiary"
                                    size="sm"
                                    iconLeading={X}
                                    onClick={() => {
                                        close();
                                        handleClose();
                                    }}
                                    className="p-1!"
                                />
                            </div>

                            <div className="w-full flex flex-col gap-6">
                                {isAdmin && (
                                    <div className="flex items-center justify-between p-4 border border-secondary rounded-lg bg-secondary/5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium text-primary">Post as OpenMidmarket</span>
                                            <span className="text-xs text-tertiary">Post on behalf of the system account</span>
                                        </div>
                                        <Toggle
                                            isSelected={postAsSystem}
                                            onChange={setPostAsSystem}
                                        />
                                    </div>
                                )}
                                <div className="flex flex-col gap-3">
                                    <span className="text-sm font-medium text-secondary">Select post type</span>
                                    <div className="flex gap-2">
                                        <Button
                                            color={postType === "post" ? "primary" : "secondary"}
                                            size="sm"
                                            onClick={() => setPostType("post")}
                                            className="flex-1 lg:flex-none"
                                        >
                                            Post
                                        </Button>
                                        <Button
                                            color={postType === "link" ? "primary" : "secondary"}
                                            size="sm"
                                            onClick={() => setPostType("link")}
                                            className="flex-1 lg:flex-none"
                                        >
                                            Link
                                        </Button>
                                    </div>
                                </div>
                                {postType === "link" && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <Input
                                            label="URL"
                                            placeholder="https://example.com"
                                            value={postUrl}
                                            onChange={setPostUrl}
                                        />
                                    </div>
                                )}

                                {postType !== "link" && (
                                    <TextArea
                                        label="What's on your mind?"
                                        placeholder="Share your thoughts with the community..."
                                        value={postContent}
                                        onChange={setPostContent}
                                        rows={4}
                                    />
                                )}

                                <div className="flex flex-col gap-3">
                                    <span className="text-sm font-medium text-secondary">Attachments</span>
                                    <div className="flex flex-wrap gap-3">
                                        {attachedFileUrl ? (
                                            <div className="relative w-32 h-32 border border-secondary rounded-lg overflow-hidden group bg-secondary/5 flex items-center justify-center p-2">
                                                {attachedFileUrl.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i) ? (
                                                    <img src={attachedFileUrl} className="w-full h-full object-cover rounded-md" />
                                                ) : (
                                                    <div className="flex flex-col items-center text-center gap-1">
                                                        <File02 className="size-8 text-tertiary" />
                                                        <span className="text-[10px] font-medium text-secondary truncate w-24">
                                                            {decodeURIComponent(attachedFileUrl.split('/').pop()?.split('-').slice(1).join('-') || "File")}
                                                        </span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => setAttachedFileUrl(null)}
                                                    className="absolute top-1 right-1 p-1 bg-primary/80 rounded-full text-primary opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
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
                                                <div className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-secondary rounded-lg hover:border-tertiary transition-colors bg-secondary/5">
                                                    {isUploadingFile ? (
                                                        <div className="text-xs text-tertiary animate-pulse">Uploading...</div>
                                                    ) : (
                                                        <>
                                                            <File02 className="size-6 text-tertiary mb-2" />
                                                            <span className="text-xs text-tertiary">Add file</span>
                                                        </>
                                                    )}
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-secondary -mx-6 px-6 mt-2">
                                <Button
                                    color="secondary"
                                    onClick={() => {
                                        close();
                                        handleClose();
                                    }}
                                    className="flex-1 sm:flex-none"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => handleCreatePost(close)}
                                    isLoading={isSubmitting}
                                    isDisabled={postType === "link" ? !postUrl.trim() : !postContent.trim()}
                                    className="flex-1 sm:flex-none"
                                >
                                    Share
                                </Button>
                            </div>
                        </div>
                    )}
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
