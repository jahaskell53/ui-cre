import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventInvites, events } from "@/db/schema";
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
            return NextResponse.json({ error: "Only event owners can view invites" }, { status: 403 });
        }

        const invites = await db.select().from(eventInvites).where(eq(eventInvites.eventId, eventId)).orderBy(desc(eventInvites.createdAt));

        return NextResponse.json(
            invites.map((i) => ({
                id: i.id,
                event_id: i.eventId,
                user_id: i.userId,
                message: i.message,
                recipient_count: i.recipientCount,
                created_at: i.createdAt,
                recipient_emails: i.recipientEmails,
            })),
        );
    } catch (error: any) {
        console.error("Error in GET /api/events/[id]/invites:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
