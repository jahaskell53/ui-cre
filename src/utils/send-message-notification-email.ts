import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { EmailService } from "@/utils/email-service";
import { generateMessageNotificationEmail } from "@/utils/email-templates";

export async function sendMessageNotificationEmail(messageId: string): Promise<boolean> {
    try {
        const supabase = await createClient();
        const adminSupabase = createAdminClient();

        // Get message with sender and recipient info
        const { data: message, error: messageError } = await supabase
            .from("messages")
            .select(`
                id,
                sender_id,
                recipient_id,
                content,
                sender:profiles!messages_sender_id_fkey(
                    id,
                    username,
                    full_name,
                    avatar_url
                )
            `)
            .eq("id", messageId)
            .single();

        if (messageError || !message) {
            console.error("Error fetching message for email:", messageError);
            return false;
        }

        // Get recipient email from auth.users using admin client
        const { data: recipientUser, error: userError } = await adminSupabase.auth.admin.getUserById(message.recipient_id);
        
        if (userError || !recipientUser?.user?.email) {
            console.error("Error fetching recipient email:", userError);
            return false;
        }

        const recipientEmail = recipientUser.user.email;

        // Generate email content
        // TypeScript infers sender as potentially an array from Supabase types,
        // but in practice it's always a single object due to the foreign key relationship
        const sender = message.sender;
        const senderProfile = Array.isArray(sender) ? sender[0] : sender;
        const senderName = senderProfile?.full_name || senderProfile?.username || "Someone";
        const messageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/messages?user_id=${message.sender_id}`;
        
        const emailContent = generateMessageNotificationEmail({
            senderName,
            senderUsername: senderProfile?.username || undefined,
            messageContent: message.content,
            messageUrl,
        });

        // Send email
        const emailService = new EmailService();
        const emailSent = await emailService.sendEmail(recipientEmail, emailContent);

        return emailSent;
    } catch (error: any) {
        console.error("Error sending message notification email:", error);
        return false;
    }
}

