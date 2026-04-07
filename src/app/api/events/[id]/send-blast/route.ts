import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventBlasts, eventRegistrations, events } from "@/db/schema";
import { EmailService } from "@/utils/email-service";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient();
        const adminSupabase = createAdminClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: eventId } = await params;
        const body = await request.json();
        const { subject, message } = body;

        if (!subject || !message) {
            return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
        }

        const eventRows = await db.select({ id: events.id, title: events.title, userId: events.userId }).from(events).where(eq(events.id, eventId));

        if (eventRows.length === 0) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const event = eventRows[0];

        if (event.userId !== user.id) {
            return NextResponse.json({ error: "Only event owners can send blasts" }, { status: 403 });
        }

        const registrations = await db.select({ userId: eventRegistrations.userId }).from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));

        if (registrations.length === 0) {
            return NextResponse.json({ error: "No registered attendees found" }, { status: 400 });
        }

        const userIds = registrations.map((reg) => reg.userId);
        const emailAddresses: string[] = [];

        for (const userId of userIds) {
            try {
                const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(userId);

                if (!userError && userData?.user?.email) {
                    emailAddresses.push(userData.user.email);
                }
            } catch (err) {
                console.error(`Error fetching email for user ${userId}:`, err);
            }
        }

        if (emailAddresses.length === 0) {
            return NextResponse.json({ error: "No valid email addresses found" }, { status: 400 });
        }

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
            ${message
                .split("\n")
                .map((line: string) => `<p style="margin: 0 0 12px 0;">${line || "<br>"}</p>`)
                .join("")}
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

        const emailService = new EmailService();
        const results = await Promise.allSettled(
            emailAddresses.map((email) =>
                emailService.sendEmail(email, {
                    subject,
                    html: htmlContent,
                    text: textContent,
                }),
            ),
        );

        const successful = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
        const failed = results.length - successful;

        const inserted = await db
            .insert(eventBlasts)
            .values({
                eventId,
                userId: user.id,
                subject,
                message,
                recipientCount: emailAddresses.length,
                sentCount: successful,
                failedCount: failed,
            })
            .returning();

        const blast = inserted[0];

        return NextResponse.json({
            success: true,
            sent: successful,
            failed,
            total: emailAddresses.length,
            blast_id: blast?.id,
        });
    } catch (error: any) {
        console.error("Error sending blast:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
