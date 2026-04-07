import { and, asc, eq, inArray, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, profiles } from "@/db/schema";
import { sendMessageNotificationEmail } from "@/utils/send-message-notification-email";
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
        const { recipient_id, content } = body;

        if (!recipient_id) {
            return NextResponse.json({ error: "recipient_id is required" }, { status: 400 });
        }

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return NextResponse.json({ error: "content is required and cannot be empty" }, { status: 400 });
        }

        if (recipient_id === user.id) {
            return NextResponse.json({ error: "Cannot send message to yourself" }, { status: 400 });
        }

        // Verify recipient exists
        const [recipient] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, recipient_id));

        if (!recipient) {
            return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
        }

        // Insert message
        const [message] = await db
            .insert(messages)
            .values({
                senderId: user.id,
                recipientId: recipient_id,
                content: content.trim(),
            })
            .returning();

        if (!message) {
            return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
        }

        const responseMessage = {
            id: message.id,
            sender_id: message.senderId,
            recipient_id: message.recipientId,
            content: message.content,
            created_at: message.createdAt,
            read_at: message.readAt,
        };

        // Send email notification asynchronously (don't wait for it)
        sendMessageNotificationEmail(message.id).catch((error) => {
            console.error("Error sending email notification:", error);
        });

        return NextResponse.json(responseMessage, { status: 201 });
    } catch (error: any) {
        console.error("Error in POST /api/messages:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

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

        const searchParams = request.nextUrl.searchParams;
        const otherUserId = searchParams.get("user_id");

        if (!otherUserId) {
            return NextResponse.json({ error: "user_id query parameter is required" }, { status: 400 });
        }

        // Get messages between current user and other user
        const rows = await db
            .select({
                id: messages.id,
                sender_id: messages.senderId,
                recipient_id: messages.recipientId,
                content: messages.content,
                created_at: messages.createdAt,
                read_at: messages.readAt,
            })
            .from(messages)
            .where(
                or(
                    and(eq(messages.senderId, user.id), eq(messages.recipientId, otherUserId)),
                    and(eq(messages.senderId, otherUserId), eq(messages.recipientId, user.id)),
                ),
            )
            .orderBy(asc(messages.createdAt));

        // Mark messages as read if they were sent to current user
        const unreadIds = rows.filter((m) => m.recipient_id === user.id && !m.read_at).map((m) => m.id);

        if (unreadIds.length > 0) {
            await db.update(messages).set({ readAt: new Date().toISOString() }).where(inArray(messages.id, unreadIds));
        }

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error("Error in GET /api/messages:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
