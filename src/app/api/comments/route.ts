import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { parseMentions } from "@/utils/parse-mentions";
import { sendMentionNotificationEmail } from "@/utils/send-mention-notification-email";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { post_id, content } = body;

        if (!post_id) {
            return NextResponse.json({ error: "post_id is required" }, { status: 400 });
        }

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return NextResponse.json({ error: "content is required and cannot be empty" }, { status: 400 });
        }

        // Verify post exists
        const { data: post, error: postError } = await supabase
            .from("posts")
            .select("id")
            .eq("id", post_id)
            .single();

        if (postError || !post) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }

        // Insert comment
        const { data: comment, error: insertError } = await supabase
            .from("comments")
            .insert({
                post_id,
                user_id: user.id,
                content: content.trim(),
            })
            .select()
            .single();

        if (insertError) {
            console.error("Error inserting comment:", insertError);
            return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
        }

        // Process mentions by full_name
        const mentionedNames = parseMentions(content);
        if (mentionedNames.length > 0) {
            // Look up profiles by full_name
            const { data: mentionedProfiles, error: profilesError } = await supabase
                .from("profiles")
                .select("id, full_name")
                .in("full_name", mentionedNames);

            if (!profilesError && mentionedProfiles) {
                // Send email notifications to mentioned users (excluding the comment author)
                const mentionedUserIds = mentionedProfiles
                    .filter(profile => profile.id !== user.id)
                    .map(profile => profile.id);

                // Send emails asynchronously (don't wait for them)
                mentionedUserIds.forEach(mentionedUserId => {
                    sendMentionNotificationEmail(comment.id, mentionedUserId, post_id).catch(error => {
                        console.error("Error sending mention notification email:", error);
                        // Don't fail the request if email fails
                    });
                });
            }
        }

        return NextResponse.json(comment, { status: 201 });
    } catch (error: any) {
        console.error("Error in POST /api/comments:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

