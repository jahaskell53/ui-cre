import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get("id");

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // For public access (unauthenticated), use admin client to bypass RLS
        // For authenticated users, use regular client
        const client = user ? supabase : createAdminClient();

        // Fetch profile for the specified user (public access)
        const { data, error } = await client
            .from("profiles")
            .select("id, full_name, avatar_url, website, roles")
            .eq("id", userId)
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in GET /api/users:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
