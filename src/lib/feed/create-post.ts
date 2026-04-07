export type FeedPostType = "post" | "link";

export interface FeedPostDraft {
    postType: FeedPostType;
    postContent: string;
    postUrl: string;
    attachedFileUrl: string | null;
    postAsSystem: boolean;
}

export const DEFAULT_FEED_POST_DRAFT: FeedPostDraft = {
    postType: "post",
    postContent: "",
    postUrl: "",
    attachedFileUrl: null,
    postAsSystem: false,
};

export interface ResolvedPostAuthor {
    userIdToUse: string;
    fellBackToUser: boolean;
}

export interface UploadPostAttachmentResult {
    url: string | null;
    error: string | null;
}

export function getFeedInitials(name: string | null | undefined, fallback = "U"): string {
    const trimmedName = name?.trim();
    if (!trimmedName) {
        return fallback;
    }

    return (
        trimmedName
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || fallback
    );
}

export function canSubmitFeedPost(postType: FeedPostType, postContent: string, postUrl: string): boolean {
    return postType === "link" ? postUrl.trim().length > 0 : postContent.trim().length > 0;
}

export function getFeedPostContent(postType: FeedPostType, postContent: string, postUrl: string): string {
    return postType === "link" ? postUrl.trim() : postContent.trim();
}

export function isImageAttachment(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);
}

export function getAttachmentDisplayName(url: string): string {
    return decodeURIComponent(url.split("/").pop()?.split("-").slice(1).join("-") || "File");
}

export async function resolvePostAuthorId({
    isAdmin,
    postAsSystem,
    userId,
    lookupSystemProfileId,
}: {
    isAdmin: boolean;
    postAsSystem: boolean;
    userId: string;
    lookupSystemProfileId: () => Promise<string | null>;
}): Promise<ResolvedPostAuthor> {
    if (!postAsSystem || !isAdmin) {
        return { userIdToUse: userId, fellBackToUser: false };
    }

    const systemProfileId = await lookupSystemProfileId();
    if (!systemProfileId) {
        return { userIdToUse: userId, fellBackToUser: true };
    }

    return { userIdToUse: systemProfileId, fellBackToUser: false };
}

export async function uploadPostAttachment(
    file: File,
    upload: (formData: FormData) => Promise<Response>,
): Promise<UploadPostAttachmentResult> {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await upload(formData);
        const data = await response.json();

        if (!response.ok) {
            return { url: null, error: data.error || "Failed to upload file" };
        }

        return { url: data.url ?? null, error: data.url ? null : "Failed to upload file" };
    } catch {
        return { url: null, error: "Failed to upload file" };
    }
}
