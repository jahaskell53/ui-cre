import { NextRequest, NextResponse } from "next/server";

const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get("q");

        if (!query || query.trim().length === 0) {
            return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
        }

        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=address,poi`
        );

        if (!response.ok) {
            throw new Error("Failed to fetch from Mapbox");
        }

        const data = await response.json();

        // Transform Mapbox response to a simpler format
        const suggestions = data.features.map((feature: any) => ({
            id: feature.id,
            address: feature.place_name,
            fullAddress: feature.place_name,
            coordinates: feature.center, // [lng, lat]
            context: feature.context,
        }));

        return NextResponse.json({ suggestions });
    } catch (error: any) {
        console.error("Error in GET /api/geocode:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

