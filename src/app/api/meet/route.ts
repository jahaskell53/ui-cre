import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createMeetLink, isGoogleMeetConfigured } from "@/lib/google-meet";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if Google Meet is configured
        if (!isGoogleMeetConfigured()) {
            return NextResponse.json(
                { error: "Google Meet is not configured" },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { title, start_time, end_time, description } = body;

        if (!title || !start_time || !end_time) {
            return NextResponse.json(
                { error: "title, start_time, and end_time are required" },
                { status: 400 }
            );
        }

        const startTime = new Date(start_time);
        const endTime = new Date(end_time);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            return NextResponse.json(
                { error: "Invalid date format" },
                { status: 400 }
            );
        }

        const meetLink = await createMeetLink({
            title,
            startTime,
            endTime,
            description,
        });

        if (!meetLink) {
            return NextResponse.json(
                { error: "Failed to create Meet link" },
                { status: 500 }
            );
        }

        return NextResponse.json({ meet_link: meetLink });
    } catch (error: any) {
        console.error("Error in POST /api/meet:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Simple endpoint to check if Google Meet is configured
    const configured = isGoogleMeetConfigured();
    return NextResponse.json({ configured });
}
