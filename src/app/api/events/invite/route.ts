import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { EmailService } from "@/utils/email-service";
import { generateEventInviteEmail } from "@/utils/email-templates";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { event_id, emails } = body;

        if (!event_id || !emails || !Array.isArray(emails) || emails.length === 0) {
            return NextResponse.json({ error: "Invalid request. Event ID and emails are required." }, { status: 400 });
        }

        // Fetch event details
        const { data: event, error: eventError } = await supabase
            .from("events")
            .select("*")
            .eq("id", event_id)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        // Fetch host profile
        const { data: hostProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();

        const hostName = hostProfile?.full_name || "A friend";
        const emailService = new EmailService();
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        // Generate email content
        const eventDate = new Date(event.start_time).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
        });
        const eventTime = new Date(event.start_time).toLocaleTimeString("en-US", {
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
            eventImageUrl: event.image_url
        });

        // Send emails to all recipients
        const sendResults = await Promise.all(
            emails.map(email => emailService.sendEmail(email.trim(), emailContent))
        );

        const successCount = sendResults.filter(Boolean).length;

        return NextResponse.json({
            success: true,
            message: `Successfully sent ${successCount} out of ${emails.length} invitations.`
        });

    } catch (error: any) {
        console.error("Error in POST /api/events/invite:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
