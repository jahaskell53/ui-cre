import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventInvites, events, profiles } from "@/db/schema";
import { EmailService } from "@/utils/email-service";
import { generateEventInviteEmail } from "@/utils/email-templates";
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
        const { event_id, emails, message } = body;

        if (!event_id || !emails || !Array.isArray(emails) || emails.length === 0) {
            return NextResponse.json({ error: "Invalid request. Event ID and emails are required." }, { status: 400 });
        }

        const eventRows = await db.select().from(events).where(eq(events.id, event_id));

        if (eventRows.length === 0) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const event = eventRows[0];

        const profileRows = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, user.id));
        const hostName = profileRows[0]?.fullName || "A friend";

        const emailService = new EmailService();
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const eventDate = new Date(event.startTime).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
        });
        const eventTime = new Date(event.startTime).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
        const eventUrl = `${baseUrl}/events/${event.id}`;

        const emailContent = generateEventInviteEmail({
            hostName,
            eventTitle: event.title,
            eventDate,
            eventTime,
            eventUrl,
            eventImageUrl: event.imageUrl,
            message: message || "We'd love to see you there!",
        });

        const trimmedEmails = emails.map((email: string) => email.trim()).filter((email: string) => email.length > 0);
        if (trimmedEmails.length === 0) {
            return NextResponse.json({ error: "No valid email addresses provided." }, { status: 400 });
        }

        const senderEmail = user.email || trimmedEmails[0];
        const success = await emailService.sendEmail(senderEmail, emailContent, undefined, trimmedEmails);

        if (success) {
            await db.insert(eventInvites).values({
                eventId: event_id,
                userId: user.id,
                message: message || null,
                recipientCount: trimmedEmails.length,
                recipientEmails: trimmedEmails,
            });
        }

        return NextResponse.json({
            success,
            message: success
                ? `Successfully sent invitation to ${trimmedEmails.length} recipient${trimmedEmails.length === 1 ? "" : "s"}.`
                : "Failed to send invitations.",
        });
    } catch (error: any) {
        console.error("Error in POST /api/events/invite:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
