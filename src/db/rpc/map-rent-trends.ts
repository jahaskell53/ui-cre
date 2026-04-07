import { supabase } from "@/utils/supabase";

export interface MapRentTrendZipRow {
    zip: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

export interface MapRentTrendNeighborhoodRow {
    neighborhood_id: number;
    name: string;
    city: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

export interface MapRentTrendCountyRow {
    county_name: string;
    state: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

export interface MapRentTrendMsaRow {
    geoid: string;
    name: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

export interface MapRentTrendCityRow {
    city_name: string;
    state: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

interface BaseMapRentTrendsParams {
    p_beds: number;
    p_weeks_back: number;
    p_reits_only: boolean;
}

export async function getMapRentTrends(params: BaseMapRentTrendsParams): Promise<MapRentTrendZipRow[]> {
    const { data, error } = await supabase.rpc("get_map_rent_trends", params);
    if (error) throw error;
    return (data ?? []) as MapRentTrendZipRow[];
}

export async function getMapRentTrendsByNeighborhood(params: BaseMapRentTrendsParams): Promise<MapRentTrendNeighborhoodRow[]> {
    const { data, error } = await supabase.rpc("get_map_rent_trends_by_neighborhood", params);
    if (error) throw error;
    return (data ?? []) as MapRentTrendNeighborhoodRow[];
}

export async function getMapRentTrendsByCounty(params: BaseMapRentTrendsParams): Promise<MapRentTrendCountyRow[]> {
    const { data, error } = await supabase.rpc("get_map_rent_trends_by_county", params);
    if (error) throw error;
    return (data ?? []) as MapRentTrendCountyRow[];
}

export async function getMapRentTrendsByMsa(params: BaseMapRentTrendsParams): Promise<MapRentTrendMsaRow[]> {
    const { data, error } = await supabase.rpc("get_map_rent_trends_by_msa", params);
    if (error) throw error;
    return (data ?? []) as MapRentTrendMsaRow[];
}

export async function getMapRentTrendsByCity(params: BaseMapRentTrendsParams): Promise<MapRentTrendCityRow[]> {
    const { data, error } = await supabase.rpc("get_map_rent_trends_by_city", params);
    if (error) throw error;
    return (data ?? []) as MapRentTrendCityRow[];
}
