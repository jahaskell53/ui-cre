import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventBlasts, events } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: eventId } = await params;

        const eventRows = await db.select({ id: events.id, userId: events.userId }).from(events).where(eq(events.id, eventId));

        if (eventRows.length === 0) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const event = eventRows[0];

        if (event.userId !== user.id) {
            return NextResponse.json({ error: "Only event owners can view blasts" }, { status: 403 });
        }

        const blasts = await db.select().from(eventBlasts).where(eq(eventBlasts.eventId, eventId)).orderBy(desc(eventBlasts.createdAt));

        return NextResponse.json(
            blasts.map((b) => ({
                id: b.id,
                event_id: b.eventId,
                user_id: b.userId,
                subject: b.subject,
                message: b.message,
                recipient_count: b.recipientCount,
                sent_count: b.sentCount,
                failed_count: b.failedCount,
                created_at: b.createdAt,
            })),
        );
    } catch (error: any) {
        console.error("Error in GET /api/events/[id]/blasts:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
