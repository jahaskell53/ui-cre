import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { comments, likes, posts, profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get("user_id");

        let query = db
            .select({
                id: posts.id,
                userId: posts.userId,
                type: posts.type,
                content: posts.content,
                fileUrl: posts.fileUrl,
                createdAt: posts.createdAt,
                updatedAt: posts.updatedAt,
                profile: {
                    fullName: profiles.fullName,
                    avatarUrl: profiles.avatarUrl,
                },
            })
            .from(posts)
            .leftJoin(profiles, eq(posts.userId, profiles.id))
            .orderBy(desc(posts.createdAt));

        const rows = userId ? await query.where(eq(posts.userId, userId)) : await query;

        const postIds = rows.map((r) => r.id);

        const [likesRows, commentsRows] = await Promise.all([
            postIds.length > 0 ? db.select({ postId: likes.postId, userId: likes.userId }).from(likes).where(inArray(likes.postId, postIds)) : [],
            postIds.length > 0 ? db.select({ postId: comments.postId }).from(comments).where(inArray(comments.postId, postIds)) : [],
        ]);

        const result = rows.map((r) => ({
            id: r.id,
            user_id: r.userId,
            type: r.type,
            content: r.content,
            file_url: r.fileUrl,
            created_at: r.createdAt,
            updated_at: r.updatedAt,
            profile: r.profile ? { full_name: r.profile.fullName, avatar_url: r.profile.avatarUrl } : null,
            likes: likesRows.filter((l) => l.postId === r.id).map((l) => ({ post_id: l.postId, user_id: l.userId })),
            comments_count: commentsRows.filter((c) => c.postId === r.id).length,
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error in GET /api/posts:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

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
        const { user_id, type, content, file_url } = body;

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return NextResponse.json({ error: "content is required" }, { status: 400 });
        }

        const inserted = await db
            .insert(posts)
            .values({
                userId: user_id ?? user.id,
                type: type ?? "post",
                content: content.trim(),
                fileUrl: file_url ?? null,
            })
            .returning();

        if (inserted.length === 0) {
            return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
        }

        const p = inserted[0];
        return NextResponse.json(
            {
                id: p.id,
                user_id: p.userId,
                type: p.type,
                content: p.content,
                file_url: p.fileUrl,
                created_at: p.createdAt,
                updated_at: p.updatedAt,
            },
            { status: 201 },
        );
    } catch (error: any) {
        console.error("Error in POST /api/posts:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const postId = searchParams.get("id");

        if (!postId) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        const deleted = await db
            .delete(posts)
            .where(and(eq(posts.id, postId), eq(posts.userId, user.id)))
            .returning({ id: posts.id });

        if (deleted.length === 0) {
            return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/posts:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
