import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { integrations, profiles } from "@/db/schema";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get("id");
        const fullName = searchParams.get("full_name");

        if (!userId && !fullName) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        if (fullName) {
            const nameRows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.fullName, fullName)).limit(1);

            if (nameRows.length === 0) {
                return NextResponse.json({ error: "Profile not found" }, { status: 404 });
            }

            return NextResponse.json({ id: nameRows[0].id });
        }

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
            .where(eq(profiles.id, userId));

        if (rows.length === 0) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        const p = rows[0];
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
        console.error("Error in GET /api/users:", error);
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

        const adminSupabase = createAdminClient();

        // Delete user integrations first (to revoke grants)
        const userIntegrations = await db.select({ nylasGrantId: integrations.nylasGrantId }).from(integrations).where(eq(integrations.userId, user.id));

        if (userIntegrations.length > 0) {
            // Import revokeGrant dynamically to avoid issues
            const { revokeGrant } = await import("@/lib/nylas/client");
            for (const integration of userIntegrations) {
                if (integration.nylasGrantId) {
                    try {
                        await revokeGrant(integration.nylasGrantId);
                        // eslint-disable-next-line no-empty
                    } catch (err) {
                        // Continue even if revoke fails
                    }
                }
            }
        }

        // Delete the user from auth.users (this will cascade delete profile and other related data)
        const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);

        if (deleteError) {
            console.error("Error deleting user:", deleteError);
            return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/users:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
