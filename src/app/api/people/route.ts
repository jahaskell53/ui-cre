import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

// Helper function to geocode an address
async function geocodeAddress(address: string): Promise<{ latitude: number | null; longitude: number | null }> {
  if (!address || !address.trim()) {
    return { latitude: null, longitude: null };
  }

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address`
    );

    if (!response.ok) {
      console.error("Geocoding failed:", response.statusText);
      return { latitude: null, longitude: null };
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }

    return { latitude: null, longitude: null };
  } catch (error) {
    console.error("Error geocoding address:", error);
    return { latitude: null, longitude: null };
  }
}

// Helper function to geocode multiple addresses
async function geocodeAddresses(addresses: string[]): Promise<Array<{ address: string; latitude: number | null; longitude: number | null }>> {
  const results = await Promise.all(
    addresses.map(async (address) => {
      const coords = await geocodeAddress(address);
      return {
        address,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
    })
  );
  return results;
}

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

        // Fetch people for the current user
        let query = supabase
            .from("people")
            .select("*")
            .eq("user_id", user.id);

        if (personId) {
            const { data, error } = await query.eq("id", personId).single();
            if (error) {
                console.error("Error fetching person:", error);
                return NextResponse.json({ error: "Person not found" }, { status: 404 });
            }
            return NextResponse.json(data);
        }

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching people:", error);
            return NextResponse.json({ error: "Failed to fetch people" }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error("Error in GET /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, starred, email, phone, category, signal, address, owned_addresses, timeline } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Geocode addresses
        const addressTrimmed = address?.trim() || null;
        const homeGeo = addressTrimmed ? await geocodeAddress(addressTrimmed) : { latitude: null, longitude: null };
        
        const ownedAddressesList = owned_addresses || [];
        const ownedAddressesGeo = ownedAddressesList.length > 0 
          ? await geocodeAddresses(ownedAddressesList)
          : [];

        // Insert person
        const { data, error } = await supabase
            .from("people")
            .insert({
                user_id: user.id,
                name: name.trim(),
                starred: starred ?? false,
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                category: category || null,
                signal: signal ?? false,
                address: addressTrimmed,
                address_latitude: homeGeo.latitude,
                address_longitude: homeGeo.longitude,
                owned_addresses: ownedAddressesList,
                owned_addresses_geo: ownedAddressesGeo,
                timeline: timeline || [],
            })
            .select()
            .single();

        if (error) {
            console.error("Error inserting person:", error);
            return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in POST /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
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

        const body = await request.json();
        const { name, starred, email, phone, category, signal, address, owned_addresses, timeline } = body;

        // Build update object - only include fields that are provided
        const updateData: any = {};

        if (name !== undefined) updateData.name = name.trim();
        if (starred !== undefined) updateData.starred = starred;
        if (email !== undefined) updateData.email = email?.trim() || null;
        if (phone !== undefined) updateData.phone = phone?.trim() || null;
        if (category !== undefined) updateData.category = category || null;
        if (signal !== undefined) updateData.signal = signal;
        if (address !== undefined) {
          const addressTrimmed = address?.trim() || null;
          updateData.address = addressTrimmed;
          // Geocode the address if provided
          if (addressTrimmed) {
            const homeGeo = await geocodeAddress(addressTrimmed);
            updateData.address_latitude = homeGeo.latitude;
            updateData.address_longitude = homeGeo.longitude;
          } else {
            updateData.address_latitude = null;
            updateData.address_longitude = null;
          }
        }
        if (owned_addresses !== undefined) {
          const ownedAddressesList = owned_addresses || [];
          updateData.owned_addresses = ownedAddressesList;
          // Geocode owned addresses if provided
          if (ownedAddressesList.length > 0) {
            updateData.owned_addresses_geo = await geocodeAddresses(ownedAddressesList);
          } else {
            updateData.owned_addresses_geo = [];
          }
        }
        if (timeline !== undefined) updateData.timeline = timeline;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        // Update the person (RLS will ensure user can only update their own people)
        const { data, error } = await supabase
            .from("people")
            .update(updateData)
            .eq("id", personId)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            console.error("Error updating person:", error);
            return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in PUT /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
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

        // Delete the person (RLS will ensure user can only delete their own people)
        const { error } = await supabase
            .from("people")
            .delete()
            .eq("id", personId)
            .eq("user_id", user.id);

        if (error) {
            console.error("Error deleting person:", error);
            return NextResponse.json({ error: "Failed to delete person" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

