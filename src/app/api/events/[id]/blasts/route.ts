import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: eventId } = await params;

        // Verify user owns the event
        const { data: event, error: eventError } = await supabase
            .from("events")
            .select("id, user_id")
            .eq("id", eventId)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        if (event.user_id !== user.id) {
            return NextResponse.json(
                { error: "Only event owners can view blasts" },
                { status: 403 }
            );
        }

        // Fetch all blasts for this event
        const { data: blasts, error: blastsError } = await supabase
            .from("event_blasts")
            .select("*")
            .eq("event_id", eventId)
            .order("created_at", { ascending: false });

        if (blastsError) {
            console.error("Error fetching blasts:", blastsError);
            return NextResponse.json(
                { error: "Failed to fetch blasts" },
                { status: 500 }
            );
        }

        return NextResponse.json(blasts || []);
    } catch (error: any) {
        console.error("Error in GET /api/events/[id]/blasts:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
