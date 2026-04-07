import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Mark notification as read
        try {
            await db
                .update(notifications)
                .set({ readAt: new Date().toISOString() })
                .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
        } catch (dbError) {
            console.error("Error marking notification as read:", dbError);
            return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in POST /api/notifications/[id]/read:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
