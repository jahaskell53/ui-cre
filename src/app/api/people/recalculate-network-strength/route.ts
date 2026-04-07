import { NextRequest, NextResponse } from "next/server";
import { recalculateNetworkStrengthForUser } from "@/lib/network-strength";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
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

        // Recalculate network strength for the current user
        await recalculateNetworkStrengthForUser(user.id);

        return NextResponse.json({
            success: true,
            message: "Network strength recalculated for all people",
        });
    } catch (error: any) {
        console.error("Error recalculating network strength:", error);
        return NextResponse.json(
            {
                error: error.message || "Internal server error",
            },
            { status: 500 },
        );
    }
}
