import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, profiles } from "@/db/schema";
import { EmailService } from "@/utils/email-service";
import { generateMessageNotificationEmail } from "@/utils/email-templates";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export async function sendMessageNotificationEmail(messageId: string): Promise<boolean> {
    try {
        const supabase = await createClient();
        const adminSupabase = createAdminClient();

        // Get message
        const [message] = await db
            .select({
                id: messages.id,
                sender_id: messages.senderId,
                recipient_id: messages.recipientId,
                content: messages.content,
            })
            .from(messages)
            .where(eq(messages.id, messageId));

        if (!message) {
            console.error("Error fetching message for email: message not found");
            return false;
        }

        // Get sender profile
        const [senderProfile] = await db
            .select({
                id: profiles.id,
                full_name: profiles.fullName,
                avatar_url: profiles.avatarUrl,
            })
            .from(profiles)
            .where(eq(profiles.id, message.sender_id));

        // Get recipient email from auth.users using admin client
        const { data: recipientUser, error: userError } = await adminSupabase.auth.admin.getUserById(message.recipient_id);

        if (userError || !recipientUser?.user?.email) {
            console.error("Error fetching recipient email:", userError);
            return false;
        }

        const recipientEmail = recipientUser.user.email;

        const senderName = senderProfile?.full_name || "Someone";
        const messageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/messages?user_id=${message.sender_id}`;

        const emailContent = generateMessageNotificationEmail({
            senderName,
            messageContent: message.content,
            messageUrl,
        });

        const emailService = new EmailService();
        const emailSent = await emailService.sendEmail(recipientEmail, emailContent);

        return emailSent;
    } catch (error: any) {
        console.error("Error sending message notification email:", error);
        return false;
    }
}
