import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "newsletter_active, newsletter_interests, newsletter_timezone, newsletter_preferred_send_times, newsletter_subscribed_at, subscriber_id"
      )
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching preferences:", error);
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error in preferences API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const {
      newsletter_active,
      newsletter_interests,
      newsletter_timezone,
      newsletter_preferred_send_times,
    } = body;

    const updateData: Record<string, any> = {};

    if (typeof newsletter_active === "boolean") {
      updateData.newsletter_active = newsletter_active;
      if (newsletter_active && !body.newsletter_subscribed_at) {
        updateData.newsletter_subscribed_at = new Date().toISOString();
      }
    }
    if (newsletter_interests !== undefined) {
      updateData.newsletter_interests = newsletter_interests;
    }
    if (newsletter_timezone !== undefined) {
      updateData.newsletter_timezone = newsletter_timezone;
    }
    if (newsletter_preferred_send_times !== undefined) {
      updateData.newsletter_preferred_send_times = newsletter_preferred_send_times;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating preferences:", error);
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in preferences API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
