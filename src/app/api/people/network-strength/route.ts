import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { people } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const personId = searchParams.get("id");

        if (!personId) {
            return NextResponse.json({ error: "Person ID is required" }, { status: 400 });
        }

        const rows = await db
            .select({ networkStrength: people.networkStrength })
            .from(people)
            .where(and(eq(people.id, personId), eq(people.userId, user.id)));

        if (rows.length === 0) {
            return NextResponse.json({ error: "Person not found" }, { status: 404 });
        }

        return NextResponse.json({
            networkStrength: rows[0].networkStrength || "MEDIUM",
        });
    } catch (error: any) {
        console.error("Error in GET /api/people/network-strength:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
