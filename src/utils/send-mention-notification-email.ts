import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comments, profiles } from "@/db/schema";
import { EmailService } from "@/utils/email-service";
import { generateMentionNotificationEmail } from "@/utils/email-templates";
import { createAdminClient } from "@/utils/supabase/admin";

export async function sendMentionNotificationEmail(commentId: string, mentionedUserId: string, postId: string): Promise<boolean> {
    try {
        const adminSupabase = createAdminClient();

        const commentRows = await db
            .select({ id: comments.id, userId: comments.userId, content: comments.content, postId: comments.postId })
            .from(comments)
            .where(eq(comments.id, commentId));

        if (commentRows.length === 0) {
            console.error("Error fetching comment for email: not found");
            return false;
        }

        const comment = commentRows[0];

        const senderProfileRows = await db
            .select({ id: profiles.id, fullName: profiles.fullName, avatarUrl: profiles.avatarUrl })
            .from(profiles)
            .where(eq(profiles.id, comment.userId));

        const senderProfile = senderProfileRows[0] ?? null;

        const { data: mentionedUser, error: userError } = await adminSupabase.auth.admin.getUserById(mentionedUserId);

        if (userError || !mentionedUser?.user?.email) {
            console.error("Error fetching mentioned user email:", userError);
            return false;
        }

        const mentionedUserEmail = mentionedUser.user.email;

        const senderName = senderProfile?.fullName || "Someone";
        const postUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`;

        const emailContent = generateMentionNotificationEmail({
            senderName,
            commentContent: comment.content,
            postUrl,
        });

        const emailService = new EmailService();
        const emailSent = await emailService.sendEmail(mentionedUserEmail, emailContent);

        return emailSent;
    } catch (error: any) {
        console.error("Error sending mention notification email:", error);
        return false;
    }
}
