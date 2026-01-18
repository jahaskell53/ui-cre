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
    const personId = searchParams.get("id");

    if (!personId) {
      return NextResponse.json({ error: "Person ID is required" }, { status: 400 });
    }

    // Fetch the person's network strength (stored in database)
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("network_strength")
      .eq("id", personId)
      .eq("user_id", user.id)
      .single();

    if (personError) {
      console.error("Error fetching person network strength:", personError);
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      networkStrength: person.network_strength || "MEDIUM" 
    });
  } catch (error: any) {
    console.error("Error in GET /api/people/network-strength:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
