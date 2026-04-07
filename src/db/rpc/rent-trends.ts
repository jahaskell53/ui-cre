import { supabase } from "@/utils/supabase";

export interface RentTrendRow {
    week_start: string;
    beds: number;
    median_rent: number;
    listing_count: number;
}

interface BaseRentTrendsParams {
    p_beds: number | null;
    p_reits_only: boolean;
    p_home_type: string | null;
}

export async function getRentTrends(params: BaseRentTrendsParams & { p_zip: string }): Promise<RentTrendRow[]> {
    const { data, error } = await supabase.rpc("get_rent_trends", params);
    if (error) throw error;
    return (data ?? []) as RentTrendRow[];
}

export async function getRentTrendsByNeighborhood(params: BaseRentTrendsParams & { p_neighborhood_ids: number[] }): Promise<RentTrendRow[]> {
    const { data, error } = await supabase.rpc("get_rent_trends_by_neighborhood", params);
    if (error) throw error;
    return (data ?? []) as RentTrendRow[];
}

export async function getRentTrendsByCity(params: BaseRentTrendsParams & { p_city: string; p_state: string }): Promise<RentTrendRow[]> {
    const { data, error } = await supabase.rpc("get_rent_trends_by_city", params);
    if (error) throw error;
    return (data ?? []) as RentTrendRow[];
}

export async function getRentTrendsByCounty(params: BaseRentTrendsParams & { p_county_name: string; p_state: string }): Promise<RentTrendRow[]> {
    const { data, error } = await supabase.rpc("get_rent_trends_by_county", params);
    if (error) throw error;
    return (data ?? []) as RentTrendRow[];
}

export async function getRentTrendsByMsa(params: BaseRentTrendsParams & { p_geoid: string }): Promise<RentTrendRow[]> {
    const { data, error } = await supabase.rpc("get_rent_trends_by_msa", params);
    if (error) throw error;
    return (data ?? []) as RentTrendRow[];
}
