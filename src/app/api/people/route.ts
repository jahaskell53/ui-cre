import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { people } from "@/db/schema";
import { recalculateNetworkStrengthForUser } from "@/lib/network-strength";
import { createClient } from "@/utils/supabase/server";

const MAPBOX_TOKEN = "pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA";

// Helper function to geocode an address
async function geocodeAddress(address: string): Promise<{ latitude: number | null; longitude: number | null }> {
    if (!address || !address.trim()) {
        return { latitude: null, longitude: null };
    }

    try {
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address`,
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
        }),
    );
    return results;
}

// Map Drizzle camelCase result to snake_case for API response
function toSnakeCase(row: typeof people.$inferSelect) {
    return {
        id: row.id,
        user_id: row.userId,
        name: row.name,
        starred: row.starred,
        signal: row.signal,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        email: row.email,
        timeline: row.timeline,
        address: row.address,
        owned_addresses: row.ownedAddresses,
        phone: row.phone,
        category: row.category,
        address_latitude: row.addressLatitude,
        address_longitude: row.addressLongitude,
        owned_addresses_geo: row.ownedAddressesGeo,
        bio: row.bio,
        birthday: row.birthday,
        linkedin_url: row.linkedinUrl,
        twitter_url: row.twitterUrl,
        instagram_url: row.instagramUrl,
        facebook_url: row.facebookUrl,
        network_strength: row.networkStrength,
    };
}

export async function GET(request: NextRequest) {
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

        const searchParams = request.nextUrl.searchParams;
        const personId = searchParams.get("id");

        if (personId) {
            const rows = await db
                .select()
                .from(people)
                .where(and(eq(people.userId, user.id), eq(people.id, personId)));

            if (rows.length === 0) {
                return NextResponse.json({ error: "Person not found" }, { status: 404 });
            }
            return NextResponse.json(toSnakeCase(rows[0]));
        }

        const rows = await db.select().from(people).where(eq(people.userId, user.id)).orderBy(desc(people.createdAt));

        return NextResponse.json(rows.map(toSnakeCase));
    } catch (error: any) {
        console.error("Error in GET /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

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

        const body = await request.json();
        const {
            name,
            starred,
            email,
            phone,
            category,
            signal,
            address,
            owned_addresses,
            timeline,
            bio,
            birthday,
            linkedin_url,
            twitter_url,
            instagram_url,
            facebook_url,
        } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Geocode addresses
        const addressTrimmed = address?.trim() || null;
        const homeGeo = addressTrimmed ? await geocodeAddress(addressTrimmed) : { latitude: null, longitude: null };

        const ownedAddressesList = owned_addresses || [];
        const ownedAddressesGeo = ownedAddressesList.length > 0 ? await geocodeAddresses(ownedAddressesList) : [];

        const rows = await db
            .insert(people)
            .values({
                userId: user.id,
                name: name.trim(),
                starred: starred ?? false,
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                category: category || null,
                signal: signal ?? false,
                address: addressTrimmed,
                addressLatitude: homeGeo.latitude != null ? String(homeGeo.latitude) : null,
                addressLongitude: homeGeo.longitude != null ? String(homeGeo.longitude) : null,
                ownedAddresses: ownedAddressesList,
                ownedAddressesGeo: ownedAddressesGeo,
                timeline: timeline || [],
                bio: bio?.trim() || null,
                birthday: birthday || null,
                linkedinUrl: linkedin_url?.trim() || null,
                twitterUrl: twitter_url?.trim() || null,
                instagramUrl: instagram_url?.trim() || null,
                facebookUrl: facebook_url?.trim() || null,
            })
            .returning();

        if (rows.length === 0) {
            return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
        }

        return NextResponse.json(toSnakeCase(rows[0]));
    } catch (error: any) {
        console.error("Error in POST /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
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

        const searchParams = request.nextUrl.searchParams;
        const personId = searchParams.get("id");

        if (!personId) {
            return NextResponse.json({ error: "Person ID is required" }, { status: 400 });
        }

        const body = await request.json();
        const {
            name,
            starred,
            email,
            phone,
            category,
            signal,
            address,
            owned_addresses,
            timeline,
            bio,
            birthday,
            linkedin_url,
            twitter_url,
            instagram_url,
            facebook_url,
        } = body;

        // Build update object - only include fields that are provided
        const updateData: Partial<typeof people.$inferInsert> = {};

        if (name !== undefined) updateData.name = name.trim();
        if (starred !== undefined) updateData.starred = starred;
        if (email !== undefined) updateData.email = email?.trim() || null;
        if (phone !== undefined) updateData.phone = phone?.trim() || null;
        if (category !== undefined) updateData.category = category || null;
        if (signal !== undefined) updateData.signal = signal;
        if (address !== undefined) {
            const addressTrimmed = address?.trim() || null;
            updateData.address = addressTrimmed;
            if (addressTrimmed) {
                const homeGeo = await geocodeAddress(addressTrimmed);
                updateData.addressLatitude = homeGeo.latitude != null ? String(homeGeo.latitude) : null;
                updateData.addressLongitude = homeGeo.longitude != null ? String(homeGeo.longitude) : null;
            } else {
                updateData.addressLatitude = null;
                updateData.addressLongitude = null;
            }
        }
        if (owned_addresses !== undefined) {
            const ownedAddressesList = owned_addresses || [];
            updateData.ownedAddresses = ownedAddressesList;
            if (ownedAddressesList.length > 0) {
                updateData.ownedAddressesGeo = await geocodeAddresses(ownedAddressesList);
            } else {
                updateData.ownedAddressesGeo = [];
            }
        }
        if (timeline !== undefined) updateData.timeline = timeline;
        if (bio !== undefined) updateData.bio = bio?.trim() || null;
        if (birthday !== undefined) updateData.birthday = birthday || null;
        if (linkedin_url !== undefined) updateData.linkedinUrl = linkedin_url?.trim() || null;
        if (twitter_url !== undefined) updateData.twitterUrl = twitter_url?.trim() || null;
        if (instagram_url !== undefined) updateData.instagramUrl = instagram_url?.trim() || null;
        if (facebook_url !== undefined) updateData.facebookUrl = facebook_url?.trim() || null;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        const rows = await db
            .update(people)
            .set(updateData)
            .where(and(eq(people.id, personId), eq(people.userId, user.id)))
            .returning();

        if (rows.length === 0) {
            return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
        }

        // Recalculate network strength if timeline was updated
        if (timeline !== undefined) {
            await recalculateNetworkStrengthForUser(user.id);
        }

        return NextResponse.json(toSnakeCase(rows[0]));
    } catch (error: any) {
        console.error("Error in PUT /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
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

        const searchParams = request.nextUrl.searchParams;
        const personId = searchParams.get("id");

        if (!personId) {
            return NextResponse.json({ error: "Person ID is required" }, { status: 400 });
        }

        await db.delete(people).where(and(eq(people.id, personId), eq(people.userId, user.id)));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
