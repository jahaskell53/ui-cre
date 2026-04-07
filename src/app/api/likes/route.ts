import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { likes } from "@/db/schema";
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
        const { post_id } = body;

        if (!post_id) {
            return NextResponse.json({ error: "post_id is required" }, { status: 400 });
        }

        const inserted = await db.insert(likes).values({ postId: post_id, userId: user.id }).onConflictDoNothing().returning();

        return NextResponse.json({ success: true, created: inserted.length > 0 }, { status: 201 });
    } catch (error: any) {
        console.error("Error in POST /api/likes:", error);
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
        const postId = searchParams.get("post_id");

        if (!postId) {
            return NextResponse.json({ error: "post_id is required" }, { status: 400 });
        }

        await db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userId, user.id)));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/likes:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
