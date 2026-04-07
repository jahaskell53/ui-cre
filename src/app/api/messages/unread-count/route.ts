import { and, eq, isNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Count unread notifications for the user
        const [result] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(notifications)
            .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

        return NextResponse.json({ unread_count: result?.count ?? 0 });
    } catch (error: any) {
        console.error("Error in GET /api/messages/unread-count:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
