import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendMessageNotificationEmail } from "@/utils/send-message-notification-email";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        // Get authenticated user (for verification, but this could be called by system)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
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
            // Get notification and related message
            const { data: notification, error: notificationError } = await supabase
                .from("notifications")
                .select("related_id")
                .eq("id", notification_id)
                .single();

            if (notificationError || !notification) {
                return NextResponse.json({ error: "Notification not found" }, { status: 404 });
            }

            if (!notification.related_id) {
                return NextResponse.json({ error: "Notification has no related message" }, { status: 400 });
            }

            messageId = notification.related_id;
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

