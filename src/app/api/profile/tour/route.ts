import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

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

        const body = await request.json();
        const { path } = body;

        if (!path || typeof path !== "string") {
            return NextResponse.json({ error: "path is required" }, { status: 400 });
        }

        const rows = await db.select({ tourVisitedPages: profiles.tourVisitedPages }).from(profiles).where(eq(profiles.id, user.id));

        const currentPages: string[] = (rows[0]?.tourVisitedPages as string[]) ?? [];

        if (currentPages.includes(path)) {
            return NextResponse.json({ tour_visited_pages: currentPages });
        }

        const updatedPages = [...currentPages, path];

        await db.update(profiles).set({ tourVisitedPages: updatedPages }).where(eq(profiles.id, user.id));

        return NextResponse.json({ tour_visited_pages: updatedPages });
    } catch (error: any) {
        console.error("Error in PATCH /api/profile/tour:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
