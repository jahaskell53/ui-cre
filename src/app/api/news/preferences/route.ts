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

    // Get profile with newsletter preferences
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

    // If there's a linked subscriber, fetch location preferences
    let counties: string[] = [];
    let cities: any[] = [];

    if (profile?.subscriber_id) {
      // Fetch counties
      const { data: subscriberCounties } = await supabase
        .from("subscriber_counties")
        .select("county_id, counties(name)")
        .eq("subscriber_id", profile.subscriber_id);

      if (subscriberCounties) {
        counties = subscriberCounties.map((sc: any) => sc.counties?.name).filter(Boolean);
      }

      // Fetch cities
      const { data: subscriberCities } = await supabase
        .from("subscriber_cities")
        .select("city_id, cities(name, state, state_abbr)")
        .eq("subscriber_id", profile.subscriber_id);

      if (subscriberCities) {
        cities = subscriberCities.map((sc: any) => ({
          name: sc.cities?.name,
          state: sc.cities?.state,
          stateAbbr: sc.cities?.state_abbr,
        })).filter((c: any) => c.name);
      }
    }

    return NextResponse.json({
      ...profile,
      counties,
      cities,
    });
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
      selected_counties,
      selected_cities,
    } = body;

    // First, get current profile to check for subscriber_id
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("subscriber_id, full_name")
      .eq("id", user.id)
      .single();

    let subscriberId = currentProfile?.subscriber_id;

    // If enabling newsletter and no subscriber exists, create or find one
    if (newsletter_active && !subscriberId) {
      // Check if a subscriber with this email already exists
      const { data: existingSubscriber } = await supabase
        .from("subscribers")
        .select("id")
        .eq("email", user.email)
        .single();

      if (existingSubscriber) {
        subscriberId = existingSubscriber.id;
      } else {
        // Create new subscriber
        const { data: newSubscriber, error: createError } = await supabase
          .from("subscribers")
          .insert({
            email: user.email,
            full_name: currentProfile?.full_name || user.email?.split("@")[0],
            is_active: true,
            interests: newsletter_interests,
            timezone: newsletter_timezone,
            preferred_send_times: newsletter_preferred_send_times,
          })
          .select("id")
          .single();

        if (createError) {
          console.error("Error creating subscriber:", createError);
          return NextResponse.json(
            { error: "Failed to create subscriber" },
            { status: 500 }
          );
        }
        subscriberId = newSubscriber?.id;
      }
    }

    // Update profile with newsletter preferences
    const updateData: Record<string, any> = {
      subscriber_id: subscriberId,
    };

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

    const { error: profileError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    // Update subscriber record if it exists
    if (subscriberId) {
      await supabase
        .from("subscribers")
        .update({
          is_active: newsletter_active,
          interests: newsletter_interests,
          timezone: newsletter_timezone,
          preferred_send_times: newsletter_preferred_send_times,
        })
        .eq("id", subscriberId);

      // Update county preferences
      if (selected_counties !== undefined) {
        // Delete existing county links
        await supabase
          .from("subscriber_counties")
          .delete()
          .eq("subscriber_id", subscriberId);

        // Insert new county links
        if (selected_counties.length > 0) {
          // Get county IDs from names
          const { data: counties } = await supabase
            .from("counties")
            .select("id, name")
            .in("name", selected_counties);

          if (counties && counties.length > 0) {
            const countyLinks = counties.map((county: any) => ({
              subscriber_id: subscriberId,
              county_id: county.id,
            }));

            await supabase.from("subscriber_counties").insert(countyLinks);
          }
        }
      }

      // Update city preferences
      if (selected_cities !== undefined) {
        // Delete existing city links
        await supabase
          .from("subscriber_cities")
          .delete()
          .eq("subscriber_id", subscriberId);

        // Insert new city links
        if (selected_cities.length > 0) {
          for (const city of selected_cities) {
            // Find or create city
            let { data: existingCity } = await supabase
              .from("cities")
              .select("id")
              .eq("name", city.name)
              .eq("state_abbr", city.stateAbbr)
              .single();

            if (!existingCity) {
              const { data: newCity } = await supabase
                .from("cities")
                .insert({
                  name: city.name,
                  state: city.state,
                  state_abbr: city.stateAbbr,
                })
                .select("id")
                .single();
              existingCity = newCity;
            }

            if (existingCity) {
              await supabase.from("subscriber_cities").insert({
                subscriber_id: subscriberId,
                city_id: existingCity.id,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in preferences API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
