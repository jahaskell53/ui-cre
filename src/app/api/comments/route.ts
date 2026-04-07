import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { comments, posts, profiles } from "@/db/schema";
import { parseMentions } from "@/utils/parse-mentions";
import { sendMentionNotificationEmail } from "@/utils/send-mention-notification-email";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { post_id, content } = body;

        if (!post_id) {
            return NextResponse.json({ error: "post_id is required" }, { status: 400 });
        }

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return NextResponse.json({ error: "content is required and cannot be empty" }, { status: 400 });
        }

        const postRows = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, post_id));

        if (postRows.length === 0) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        const inserted = await db
            .insert(comments)
            .values({
                postId: post_id,
                userId: user.id,
                content: content.trim(),
            })
            .returning();

        if (inserted.length === 0) {
            return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
        }

        const comment = inserted[0];

        const mentionedNames = parseMentions(content);
        if (mentionedNames.length > 0) {
            const mentionedProfiles = await db
                .select({ id: profiles.id, fullName: profiles.fullName })
                .from(profiles)
                .where(inArray(profiles.fullName, mentionedNames));

            const mentionedUserIds = mentionedProfiles.filter((p) => p.id !== user.id).map((p) => p.id);

            mentionedUserIds.forEach((mentionedUserId) => {
                sendMentionNotificationEmail(comment.id, mentionedUserId, post_id).catch((error) => {
                    console.error("Error sending mention notification email:", error);
                });
            });
        }

        return NextResponse.json(
            {
                id: comment.id,
                post_id: comment.postId,
                user_id: comment.userId,
                content: comment.content,
                created_at: comment.createdAt,
                updated_at: comment.updatedAt,
            },
            { status: 201 },
        );
    } catch (error: any) {
        console.error("Error in POST /api/comments:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
