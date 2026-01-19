import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get("id");

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Fetch profile for the specified user
        const { data, error } = await supabase
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
