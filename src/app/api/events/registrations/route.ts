import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const eventId = searchParams.get("event_id");

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        // Check if user is registered
        const { data: registration, error: regError } = await supabase
            .from("event_registrations")
            .select("id, created_at")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (regError) {
            console.error("Error checking registration:", regError);
            return NextResponse.json({ error: "Failed to check registration" }, { status: 500 });
        }

        // Get registration count for this event
        const { count, error: countError } = await supabase
            .from("event_registrations")
            .select("*", { count: "exact", head: true })
            .eq("event_id", eventId);

        if (countError) {
            console.error("Error getting registration count:", countError);
        }

        return NextResponse.json({
            is_registered: !!registration,
            registration: registration,
            count: count || 0,
        });
    } catch (error: any) {
        console.error("Error in GET /api/events/registrations:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { event_id } = body;

        if (!event_id) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        // Check if event exists
        const { data: event, error: eventError } = await supabase
            .from("events")
            .select("id, start_time")
            .eq("id", event_id)
            .single();

        if (eventError || !event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        // Register user for the event
        const { data, error } = await supabase
            .from("event_registrations")
            .insert({
                event_id,
                user_id: user.id,
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json({ error: "Already registered for this event" }, { status: 409 });
            }
            console.error("Error registering for event:", error);
            return NextResponse.json({ error: "Failed to register" }, { status: 500 });
        }

        return NextResponse.json({ success: true, registration: data });
    } catch (error: any) {
        console.error("Error in POST /api/events/registrations:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const eventId = searchParams.get("event_id");

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        const { error } = await supabase
            .from("event_registrations")
            .delete()
            .eq("event_id", eventId)
            .eq("user_id", user.id);

        if (error) {
            console.error("Error unregistering from event:", error);
            return NextResponse.json({ error: "Failed to unregister" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/events/registrations:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
