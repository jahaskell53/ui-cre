import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { EmailService } from "@/utils/email-service";
import { generateMessageNotificationEmail } from "@/utils/email-templates";

export async function sendMessageNotificationEmail(messageId: string): Promise<boolean> {
    try {
        const supabase = await createClient();
        const adminSupabase = createAdminClient();

        // Get message
        const { data: message, error: messageError } = await supabase
            .from("messages")
            .select("id, sender_id, recipient_id, content")
            .eq("id", messageId)
            .single();

        if (messageError || !message) {
            console.error("Error fetching message for email:", messageError);
            return false;
        }

        // Get sender profile (sender_id references auth.users.id, and profiles.id = auth.users.id)
        const { data: senderProfile, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", message.sender_id)
            .single();

        if (profileError) {
            console.error("Error fetching sender profile:", profileError);
            // Continue anyway, we'll use fallback values
        }

        // Get recipient email from auth.users using admin client
        const { data: recipientUser, error: userError } = await adminSupabase.auth.admin.getUserById(message.recipient_id);
        
        if (userError || !recipientUser?.user?.email) {
            console.error("Error fetching recipient email:", userError);
            return false;
        }

        const recipientEmail = recipientUser.user.email;

        // Generate email content
        const senderName = senderProfile?.full_name || "Someone";
        const messageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/messages?user_id=${message.sender_id}`;
        
        const emailContent = generateMessageNotificationEmail({
            senderName,
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

