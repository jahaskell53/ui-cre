import { ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
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
        const query = searchParams.get("q");

        if (!query || !query.trim()) {
            return NextResponse.json([]);
        }

        const limitParam = searchParams.get("limit");
        let limit = 20;
        if (limitParam !== null) {
            const parsed = Number.parseInt(limitParam, 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return NextResponse.json({ error: "limit must be a positive integer" }, { status: 400 });
            }
            limit = Math.min(parsed, 50);
        }

        const rows = await db
            .select({
                id: profiles.id,
                fullName: profiles.fullName,
                avatarUrl: profiles.avatarUrl,
                website: profiles.website,
                roles: profiles.roles,
            })
            .from(profiles)
            .where(ilike(profiles.fullName, `%${query.trim()}%`))
            .limit(limit);

        const result = rows
            .filter((r) => r.id !== user.id)
            .map((r) => ({
                id: r.id,
                full_name: r.fullName,
                avatar_url: r.avatarUrl,
                website: r.website,
                roles: r.roles,
            }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error in GET /api/users/search:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
