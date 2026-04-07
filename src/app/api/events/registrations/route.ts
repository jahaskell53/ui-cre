import { and, asc, count, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eventRegistrations, events, profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const searchParams = request.nextUrl.searchParams;
        const eventId = searchParams.get("event_id");
        const includeAttendees = searchParams.get("include_attendees") === "true";

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        let registration = null;
        let isRegistered = false;

        if (user) {
            const regRows = await db
                .select({ id: eventRegistrations.id, createdAt: eventRegistrations.createdAt })
                .from(eventRegistrations)
                .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, user.id)));

            if (regRows.length > 0) {
                registration = { id: regRows[0].id, created_at: regRows[0].createdAt };
                isRegistered = true;
            }
        }

        const countResult = await db.select({ value: count() }).from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
        const registrationCount = countResult[0]?.value ?? 0;

        let attendees = null;
        if (includeAttendees) {
            const registrations = await db
                .select({ userId: eventRegistrations.userId })
                .from(eventRegistrations)
                .where(eq(eventRegistrations.eventId, eventId))
                .orderBy(asc(eventRegistrations.createdAt));

            if (registrations.length > 0) {
                const userIds = registrations.map((reg) => reg.userId);
                const profileRows = await db
                    .select({ id: profiles.id, fullName: profiles.fullName, avatarUrl: profiles.avatarUrl })
                    .from(profiles)
                    .where(inArray(profiles.id, userIds));

                const profileMap = new Map(profileRows.map((p) => [p.id, p]));

                attendees = registrations.map((reg) => {
                    const profile = profileMap.get(reg.userId);
                    return {
                        user_id: reg.userId,
                        full_name: profile?.fullName || null,
                        avatar_url: profile?.avatarUrl || null,
                    };
                });
            } else {
                attendees = [];
            }
        }

        return NextResponse.json({
            is_registered: isRegistered,
            registration,
            count: registrationCount,
            attendees,
        });
    } catch (error: any) {
        console.error("Error in GET /api/events/registrations:", error);
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
        const { event_id } = body;

        if (!event_id) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        const eventRows = await db.select({ id: events.id, startTime: events.startTime }).from(events).where(eq(events.id, event_id));

        if (eventRows.length === 0) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        try {
            const inserted = await db
                .insert(eventRegistrations)
                .values({
                    eventId: event_id,
                    userId: user.id,
                })
                .returning();

            const reg = inserted[0];
            return NextResponse.json({
                success: true,
                registration: {
                    id: reg.id,
                    event_id: reg.eventId,
                    user_id: reg.userId,
                    created_at: reg.createdAt,
                },
            });
        } catch (err: any) {
            if (err?.code === "23505") {
                return NextResponse.json({ error: "Already registered for this event" }, { status: 409 });
            }
            console.error("Error registering for event:", err);
            return NextResponse.json({ error: "Failed to register" }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Error in POST /api/events/registrations:", error);
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
        const eventId = searchParams.get("event_id");

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        await db.delete(eventRegistrations).where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, user.id)));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/events/registrations:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
