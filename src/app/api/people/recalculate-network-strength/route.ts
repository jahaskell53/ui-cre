import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { recalculateNetworkStrengthForUser } from "@/lib/network-strength";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Recalculate network strength for the current user
    await recalculateNetworkStrengthForUser(supabase, user.id);

    return NextResponse.json({ 
      success: true, 
      message: "Network strength recalculated for all people" 
    });
  } catch (error: any) {
    console.error("Error recalculating network strength:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
