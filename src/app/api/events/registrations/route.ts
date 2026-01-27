import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // For public access (unauthenticated), use admin client to bypass RLS
        // For authenticated users, use regular client
        const client = user ? supabase : createAdminClient();

        const searchParams = request.nextUrl.searchParams;
        const eventId = searchParams.get("event_id");
        const includeAttendees = searchParams.get("include_attendees") === "true";

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        let registration = null;
        let isRegistered = false;

        // Only check user registration if authenticated
        if (user) {
            const { data: regData, error: regError } = await supabase
                .from("event_registrations")
                .select("id, created_at")
                .eq("event_id", eventId)
                .eq("user_id", user.id)
                .maybeSingle();

            if (regError) {
                console.error("Error checking registration:", regError);
                return NextResponse.json({ error: "Failed to check registration" }, { status: 500 });
            }

            registration = regData;
            isRegistered = !!regData;
        }

        // Get registration count for this event (public)
        const { count, error: countError } = await client
            .from("event_registrations")
            .select("*", { count: "exact", head: true })
            .eq("event_id", eventId);

        if (countError) {
            console.error("Error getting registration count:", countError);
        }

        let attendees = null;
        if (includeAttendees) {
            // Fetch registrations (public)
            const { data: registrations, error: registrationsError } = await client
                .from("event_registrations")
                .select("user_id")
                .eq("event_id", eventId)
                .order("created_at", { ascending: true });

            if (registrationsError) {
                console.error("Error fetching registrations:", registrationsError);
            } else if (registrations && registrations.length > 0) {
                // Get user IDs
                const userIds = registrations.map((reg: any) => reg.user_id);

                // Fetch profiles for these users (use admin client for public access)
                const profileClient = user ? supabase : createAdminClient();
                const { data: profiles, error: profilesError } = await profileClient
                    .from("profiles")
                    .select("id, full_name, avatar_url")
                    .in("id", userIds);

                if (profilesError) {
                    console.error("Error fetching profiles:", profilesError);
                } else {
                    // Create a map for quick lookup
                    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
                    
                    // Combine registration data with profile data
                    attendees = registrations.map((reg: any) => {
                        const profile = profileMap.get(reg.user_id);
                        return {
                            user_id: reg.user_id,
                            full_name: profile?.full_name || null,
                            avatar_url: profile?.avatar_url || null,
                        };
                    });
                }
            } else {
                attendees = [];
            }
        }

        return NextResponse.json({
            is_registered: isRegistered,
            registration: registration,
            count: count || 0,
            attendees: attendees,
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
