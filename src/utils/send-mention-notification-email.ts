import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { EmailService } from "@/utils/email-service";
import { generateMentionNotificationEmail } from "@/utils/email-templates";

export async function sendMentionNotificationEmail(
    commentId: string,
    mentionedUserId: string,
    postId: string
): Promise<boolean> {
    try {
        const supabase = await createClient();
        const adminSupabase = createAdminClient();

        // Get comment
        const { data: comment, error: commentError } = await supabase
            .from("comments")
            .select("id, user_id, content, post_id")
            .eq("id", commentId)
            .single();

        if (commentError || !comment) {
            console.error("Error fetching comment for email:", commentError);
            return false;
        }

        // Get sender profile
        const { data: senderProfile, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", comment.user_id)
            .single();

        if (profileError) {
            console.error("Error fetching sender profile:", profileError);
            // Continue anyway, we'll use fallback values
        }

        // Get mentioned user email from auth.users using admin client
        const { data: mentionedUser, error: userError } = await adminSupabase.auth.admin.getUserById(mentionedUserId);
        
        if (userError || !mentionedUser?.user?.email) {
            console.error("Error fetching mentioned user email:", userError);
            return false;
        }

        const mentionedUserEmail = mentionedUser.user.email;

        // Generate email content
        const senderName = senderProfile?.full_name || "Someone";
        const postUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`;
        
        const emailContent = generateMentionNotificationEmail({
            senderName,
            commentContent: comment.content,
            postUrl,
        });

        // Send email
        const emailService = new EmailService();
        const emailSent = await emailService.sendEmail(mentionedUserEmail, emailContent);

        return emailSent;
    } catch (error: any) {
        console.error("Error sending mention notification email:", error);
        return false;
    }
}

