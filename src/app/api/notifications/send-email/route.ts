import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
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
        const { notification_id, message_id } = body;

        if (!notification_id && !message_id) {
            return NextResponse.json({ error: "notification_id or message_id is required" }, { status: 400 });
        }

        let messageId: string | null = null;

        if (message_id) {
            messageId = message_id;
        } else if (notification_id) {
            const [notification] = await db.select({ relatedId: notifications.relatedId }).from(notifications).where(eq(notifications.id, notification_id));

            if (!notification) {
                return NextResponse.json({ error: "Notification not found" }, { status: 404 });
            }

            if (!notification.relatedId) {
                return NextResponse.json({ error: "Notification has no related message" }, { status: 400 });
            }

            messageId = notification.relatedId;
        }

        if (!messageId) {
            return NextResponse.json({ error: "Message ID not found" }, { status: 404 });
        }

        const emailSent = await sendMessageNotificationEmail(messageId);

        if (!emailSent) {
            return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Email sent successfully" });
    } catch (error: any) {
        console.error("Error in POST /api/notifications/send-email:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
