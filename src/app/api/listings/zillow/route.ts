import { NextRequest, NextResponse } from "next/server";
import { type ZillowMapListingRow } from "@/lib/map-listings";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
    try {
        const sp = request.nextUrl.searchParams;

        const params = {
            p_zip: sp.get("zip"),
            p_city: sp.get("city"),
            p_address_query: sp.get("address_query"),
            p_latest_only: sp.get("latest_only") === "true",
            p_price_min: sp.has("price_min") ? parseFloat(sp.get("price_min")!) : null,
            p_price_max: sp.has("price_max") ? parseFloat(sp.get("price_max")!) : null,
            p_sqft_min: sp.has("sqft_min") ? parseFloat(sp.get("sqft_min")!) : null,
            p_sqft_max: sp.has("sqft_max") ? parseFloat(sp.get("sqft_max")!) : null,
            p_beds: sp.has("beds") ? sp.get("beds")!.split(",").map(Number) : null,
            p_baths_min: sp.has("baths_min") ? parseFloat(sp.get("baths_min")!) : null,
            p_home_types: sp.has("home_types") ? sp.get("home_types")!.split(",") : null,
            p_property_type: (sp.get("property_type") ?? "both") as "both" | "reit" | "mid",
            p_bounds_south: sp.has("bounds_south") ? parseFloat(sp.get("bounds_south")!) : null,
            p_bounds_north: sp.has("bounds_north") ? parseFloat(sp.get("bounds_north")!) : null,
            p_bounds_west: sp.has("bounds_west") ? parseFloat(sp.get("bounds_west")!) : null,
            p_bounds_east: sp.has("bounds_east") ? parseFloat(sp.get("bounds_east")!) : null,
        };

        const supabase = createAdminClient();
        const { data, error } = await supabase.rpc("get_zillow_map_listings", params);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (data ?? []) as ZillowMapListingRow[];

        return NextResponse.json(rows, {
            headers: {
                "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
            },
        });
    } catch (error: any) {
        console.error("Error in GET /api/listings/zillow:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
