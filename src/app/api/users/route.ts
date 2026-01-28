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

        // Use regular client - RLS policy allows everyone to view profiles
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

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminSupabase = createAdminClient();

        // Delete user integrations first (to revoke grants)
        const { data: integrations } = await adminSupabase
            .from("integrations")
            .select("nylas_grant_id")
            .eq("user_id", user.id);

        if (integrations && integrations.length > 0) {
            // Import revokeGrant dynamically to avoid issues
            const { revokeGrant } = await import("@/lib/nylas/client");
            for (const integration of integrations) {
                if (integration.nylas_grant_id) {
                    try {
                        await revokeGrant(integration.nylas_grant_id);
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
