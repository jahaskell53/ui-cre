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
        const eventId = searchParams.get("id");
        const startDate = searchParams.get("start");
        const endDate = searchParams.get("end");

        let query = supabase
            .from("events")
            .select("*")
            .eq("user_id", user.id);

        if (eventId) {
            const { data, error } = await query.eq("id", eventId).single();
            if (error) {
                console.error("Error fetching event:", error);
                return NextResponse.json({ error: "Event not found" }, { status: 404 });
            }
            return NextResponse.json(data);
        }

        // Filter by date range if provided
        if (startDate) {
            query = query.gte("start_time", startDate);
        }
        if (endDate) {
            query = query.lte("start_time", endDate);
        }

        const { data, error } = await query.order("start_time", { ascending: true });

        if (error) {
            console.error("Error fetching events:", error);
            return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error("Error in GET /api/events:", error);
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
        const { title, description, start_time, end_time, location, color, image_url } = body;

        if (!title || typeof title !== "string" || title.trim().length === 0) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        if (!start_time || !end_time) {
            return NextResponse.json({ error: "Start and end times are required" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("events")
            .insert({
                user_id: user.id,
                title: title.trim(),
                description: description?.trim() || null,
                start_time,
                end_time,
                location: location?.trim() || null,
                color: color || "blue",
                image_url: image_url || null,
            })
            .select()
            .single();

        if (error) {
            console.error("Error inserting event:", error);
            return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in POST /api/events:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const eventId = searchParams.get("id");

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        const body = await request.json();
        const { title, description, start_time, end_time, location, color, image_url } = body;

        const updateData: any = {};

        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (start_time !== undefined) updateData.start_time = start_time;
        if (end_time !== undefined) updateData.end_time = end_time;
        if (location !== undefined) updateData.location = location?.trim() || null;
        if (color !== undefined) updateData.color = color;
        if (image_url !== undefined) updateData.image_url = image_url || null;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("events")
            .update(updateData)
            .eq("id", eventId)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            console.error("Error updating event:", error);
            return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in PUT /api/events:", error);
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
        const eventId = searchParams.get("id");

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        const { error } = await supabase
            .from("events")
            .delete()
            .eq("id", eventId)
            .eq("user_id", user.id);

        if (error) {
            console.error("Error deleting event:", error);
            return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/events:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
