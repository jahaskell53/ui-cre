import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const notificationId = params.id;

        // Mark notification as read
        const { error } = await supabase
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("id", notificationId)
            .eq("user_id", user.id);

        if (error) {
            console.error("Error marking notification as read:", error);
            return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in POST /api/notifications/[id]/read:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

