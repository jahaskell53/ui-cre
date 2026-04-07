import { supabase } from "@/utils/supabase";

export interface MarketActivityRow {
    week_start: string;
    beds: number;
    new_listings: number;
    accumulated_listings: number;
    closed_listings: number;
}

interface BaseMarketActivityParams {
    p_reits_only: boolean;
    p_home_type: string | null;
}

export async function getMarketActivity(params: BaseMarketActivityParams & { p_zip: string }): Promise<MarketActivityRow[]> {
    const { data, error } = await supabase.rpc("get_market_activity", params);
    if (error) throw error;
    return (data ?? []) as MarketActivityRow[];
}

export async function getMarketActivityByNeighborhood(params: BaseMarketActivityParams & { p_neighborhood_ids: number[] }): Promise<MarketActivityRow[]> {
    const { data, error } = await supabase.rpc("get_market_activity_by_neighborhood", params);
    if (error) throw error;
    return (data ?? []) as MarketActivityRow[];
}

export async function getMarketActivityByCity(params: BaseMarketActivityParams & { p_city: string; p_state: string }): Promise<MarketActivityRow[]> {
    const { data, error } = await supabase.rpc("get_market_activity_by_city", params);
    if (error) throw error;
    return (data ?? []) as MarketActivityRow[];
}

export async function getMarketActivityByCounty(params: BaseMarketActivityParams & { p_county_name: string; p_state: string }): Promise<MarketActivityRow[]> {
    const { data, error } = await supabase.rpc("get_market_activity_by_county", params);
    if (error) throw error;
    return (data ?? []) as MarketActivityRow[];
}

export async function getMarketActivityByMsa(params: BaseMarketActivityParams & { p_geoid: string }): Promise<MarketActivityRow[]> {
    const { data, error } = await supabase.rpc("get_market_activity_by_msa", params);
    if (error) throw error;
    return (data ?? []) as MarketActivityRow[];
}
