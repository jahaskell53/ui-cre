import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { EmailService } from "@/utils/email-service";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const adminSupabase = createAdminClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: eventId } = await params;
        const body = await request.json();
        const { subject, message } = body;

        if (!subject || !message) {
            return NextResponse.json(
                { error: "Subject and message are required" },
                { status: 400 }
            );
        }

        // Verify user owns the event
        const { data: event, error: eventError } = await supabase
            .from("events")
            .select("id, title, user_id")
            .eq("id", eventId)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        if (event.user_id !== user.id) {
            return NextResponse.json(
                { error: "Only event owners can send blasts" },
                { status: 403 }
            );
        }

        // Get all registered attendees
        const { data: registrations, error: registrationsError } = await supabase
            .from("event_registrations")
            .select("user_id")
            .eq("event_id", eventId);

        if (registrationsError) {
            console.error("Error fetching registrations:", registrationsError);
            return NextResponse.json(
                { error: "Failed to fetch registrations" },
                { status: 500 }
            );
        }

        if (!registrations || registrations.length === 0) {
            return NextResponse.json(
                { error: "No registered attendees found" },
                { status: 400 }
            );
        }

        // Get email addresses for all attendees
        const userIds = registrations.map((reg) => reg.user_id);
        const emailAddresses: string[] = [];

        for (const userId of userIds) {
            try {
                const { data: userData, error: userError } =
                    await adminSupabase.auth.admin.getUserById(userId);

                if (!userError && userData?.user?.email) {
                    emailAddresses.push(userData.user.email);
                }
            } catch (err) {
                console.error(`Error fetching email for user ${userId}:`, err);
            }
        }

        if (emailAddresses.length === 0) {
            return NextResponse.json(
                { error: "No valid email addresses found" },
                { status: 400 }
            );
        }

        // Generate email content
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const eventUrl = `${baseUrl}/events/${eventId}`;

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
        <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">
            ${event.title}
        </h1>
        <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 6px;">
            ${message.split("\n").map((line: string) => `<p style="margin: 0 0 12px 0;">${line || "<br>"}</p>`).join("")}
        </div>
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <a href="${eventUrl}" style="display: inline-block; padding: 12px 24px; background: #111827; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Event
            </a>
        </div>
    </div>
    <p style="margin-top: 24px; font-size: 12px; color: #6b7280; text-align: center;">
        You're receiving this because you registered for this event.
    </p>
</body>
</html>
        `.trim();

        const textContent = `
${event.title}

${message}

View Event: ${eventUrl}

You're receiving this because you registered for this event.
        `.trim();

        // Send emails
        const emailService = new EmailService();
        const results = await Promise.allSettled(
            emailAddresses.map((email) =>
                emailService.sendEmail(
                    email,
                    {
                        subject,
                        html: htmlContent,
                        text: textContent,
                    }
                )
            )
        );

        const successful = results.filter(
            (r) => r.status === "fulfilled" && r.value === true
        ).length;
        const failed = results.length - successful;

        // Save the blast record
        const { data: blast, error: blastError } = await supabase
            .from("event_blasts")
            .insert({
                event_id: eventId,
                user_id: user.id,
                subject,
                message,
                recipient_count: emailAddresses.length,
                sent_count: successful,
                failed_count: failed,
            })
            .select()
            .single();

        if (blastError) {
            console.error("Error saving blast record:", blastError);
            // Continue even if saving fails - email was sent
        }

        return NextResponse.json({
            success: true,
            sent: successful,
            failed,
            total: emailAddresses.length,
            blast_id: blast?.id,
        });
    } catch (error: any) {
        console.error("Error sending blast:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
