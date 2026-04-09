import { type ZillowMapListingRow } from "@/lib/map-listings";

export type { ZillowMapListingRow };

export interface GetZillowMapListingsParams {
    p_zip: string | null;
    p_city: string | null;
    p_address_query: string | null;
    p_latest_only: boolean;
    p_price_min: number | null;
    p_price_max: number | null;
    p_sqft_min: number | null;
    p_sqft_max: number | null;
    p_beds: number[] | null;
    p_baths_min: number | null;
    p_home_types: string[] | null;
    p_property_type: "both" | "reit" | "mid";
    p_bounds_south: number | null;
    p_bounds_north: number | null;
    p_bounds_west: number | null;
    p_bounds_east: number | null;
    p_limit?: number | null;
    p_offset?: number | null;
}

export async function getZillowMapListings(params: GetZillowMapListingsParams): Promise<ZillowMapListingRow[]> {
    const res = await fetch("/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fn: "get_zillow_map_listings", params }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
}
