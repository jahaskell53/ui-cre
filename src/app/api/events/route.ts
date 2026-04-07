import { and, asc, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { createMeetLink } from "@/lib/google-meet";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const searchParams = request.nextUrl.searchParams;
        const eventId = searchParams.get("id");
        const startDate = searchParams.get("start");
        const endDate = searchParams.get("end");

        if (eventId) {
            const rows = await db.select().from(events).where(eq(events.id, eventId));
            if (rows.length === 0) {
                return NextResponse.json({ error: "Event not found" }, { status: 404 });
            }
            return NextResponse.json(toSnakeCase(rows[0]));
        }

        const conditions = [];
        if (startDate) conditions.push(gte(events.startTime, startDate));
        if (endDate) conditions.push(lte(events.startTime, endDate));

        const rows = await db
            .select()
            .from(events)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(asc(events.startTime));

        return NextResponse.json(rows.map(toSnakeCase));
    } catch (error: any) {
        console.error("Error in GET /api/events:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

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
        const { title, description, start_time, end_time, location, color, image_url } = body;

        if (!title || typeof title !== "string" || title.trim().length === 0) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        if (!start_time || !end_time) {
            return NextResponse.json({ error: "Start and end times are required" }, { status: 400 });
        }

        let meetLink: string | null = null;
        try {
            meetLink = await createMeetLink({
                title: title.trim(),
                startTime: new Date(start_time),
                endTime: new Date(end_time),
                description: description?.trim(),
            });
        } catch (error) {
            console.error("Failed to create Meet link (non-blocking):", error);
        }

        const inserted = await db
            .insert(events)
            .values({
                userId: user.id,
                title: title.trim(),
                description: description?.trim() || null,
                startTime: start_time,
                endTime: end_time,
                location: location?.trim() || null,
                color: color || "blue",
                imageUrl: image_url || null,
                meetLink,
            })
            .returning();

        if (inserted.length === 0) {
            return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
        }

        return NextResponse.json(toSnakeCase(inserted[0]));
    } catch (error: any) {
        console.error("Error in POST /api/events:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

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

        const updateData: Partial<typeof events.$inferInsert> = {};

        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (start_time !== undefined) updateData.startTime = start_time;
        if (end_time !== undefined) updateData.endTime = end_time;
        if (location !== undefined) updateData.location = location?.trim() || null;
        if (color !== undefined) updateData.color = color;
        if (image_url !== undefined) updateData.imageUrl = image_url || null;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        const updated = await db
            .update(events)
            .set(updateData)
            .where(and(eq(events.id, eventId), eq(events.userId, user.id)))
            .returning();

        if (updated.length === 0) {
            return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
        }

        return NextResponse.json(toSnakeCase(updated[0]));
    } catch (error: any) {
        console.error("Error in PUT /api/events:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const eventId = searchParams.get("id");

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        await db.delete(events).where(and(eq(events.id, eventId), eq(events.userId, user.id)));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/events:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

function toSnakeCase(row: typeof events.$inferSelect) {
    return {
        id: row.id,
        user_id: row.userId,
        title: row.title,
        description: row.description,
        start_time: row.startTime,
        end_time: row.endTime,
        location: row.location,
        color: row.color,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        image_url: row.imageUrl,
        meet_link: row.meetLink,
    };
}
