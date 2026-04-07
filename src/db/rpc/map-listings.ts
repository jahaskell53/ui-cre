import { type ZillowMapListingRow } from "@/lib/map-listings";
import { supabase } from "@/utils/supabase";

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
}

export async function getZillowMapListings(params: GetZillowMapListingsParams): Promise<ZillowMapListingRow[]> {
    const { data, error } = await supabase.rpc("get_zillow_map_listings", params);
    if (error) throw error;
    return (data ?? []) as ZillowMapListingRow[];
}
