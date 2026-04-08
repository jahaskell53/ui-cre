import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        if (body === null || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
        }

        const record = body as Record<string, unknown>;
        const updateData: Partial<typeof profiles.$inferInsert> = {};

        if ("full_name" in record) {
            const v = record.full_name;
            if (v !== null && v !== undefined && typeof v !== "string") {
                return NextResponse.json({ error: "full_name must be a string or null" }, { status: 400 });
            }
            updateData.fullName = v === undefined || v === "" ? null : v;
        }

        if ("website" in record) {
            const v = record.website;
            if (v !== null && v !== undefined && typeof v !== "string") {
                return NextResponse.json({ error: "website must be a string or null" }, { status: 400 });
            }
            updateData.website = v === undefined || v === "" ? null : v;
        }

        if ("avatar_url" in record) {
            const v = record.avatar_url;
            if (v !== null && typeof v !== "string") {
                return NextResponse.json({ error: "avatar_url must be a string or null" }, { status: 400 });
            }
            updateData.avatarUrl = v;
        }

        if ("roles" in record) {
            const v = record.roles;
            if (v !== null && !isStringArray(v)) {
                return NextResponse.json({ error: "roles must be an array of strings or null" }, { status: 400 });
            }
            updateData.roles = v;
        }

        const keys = Object.keys(updateData);
        if (keys.length === 0) {
            return NextResponse.json({ error: "No valid profile fields to update" }, { status: 400 });
        }

        updateData.updatedAt = new Date().toISOString();

        await db.update(profiles).set(updateData).where(eq(profiles.id, user.id));

        const rows = await db
            .select({
                id: profiles.id,
                fullName: profiles.fullName,
                avatarUrl: profiles.avatarUrl,
                website: profiles.website,
                roles: profiles.roles,
                isAdmin: profiles.isAdmin,
                themePreference: profiles.themePreference,
                updatedAt: profiles.updatedAt,
                tourVisitedPages: profiles.tourVisitedPages,
            })
            .from(profiles)
            .where(eq(profiles.id, user.id));

        const p = rows[0];
        if (!p) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        return NextResponse.json({
            id: p.id,
            full_name: p.fullName,
            avatar_url: p.avatarUrl,
            website: p.website,
            roles: p.roles,
            is_admin: p.isAdmin,
            theme_preference: p.themePreference,
            updated_at: p.updatedAt,
            tour_visited_pages: p.tourVisitedPages,
        });
    } catch (error: any) {
        console.error("Error in PATCH /api/profile:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
