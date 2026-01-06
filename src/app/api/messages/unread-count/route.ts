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

        // Count unread messages where user is recipient and read_at is null
        const { count, error } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("recipient_id", user.id)
            .is("read_at", null);

        if (error) {
            console.error("Error counting unread messages:", error);
            return NextResponse.json({ error: "Failed to count unread messages" }, { status: 500 });
        }

        return NextResponse.json({ unread_count: count || 0 });
    } catch (error: any) {
        console.error("Error in GET /api/messages/unread-count:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

