import { supabase } from "@/utils/supabase";

export interface NeighborhoodRow {
    id: number;
    name: string;
    city: string;
    state: string;
    geojson: string;
}

export interface MsaRow {
    id: number;
    geoid: string;
    name: string;
    name_lsad: string;
}

export interface NeighborhoodAtPointRow {
    id: number;
    name: string;
    city: string;
    state: string;
}

export interface MsaAtPointRow {
    geoid: string;
    name: string;
}

export interface NeighborhoodBboxRow {
    west: number;
    south: number;
    east: number;
    north: number;
}

export interface MsaBboxRow {
    west: number;
    south: number;
    east: number;
    north: number;
}

export async function getZipBoundary(params: { p_zip: string }): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_zip_boundary", params);
    if (error) throw error;
    return data as string | null;
}

export async function getNeighborhoodBbox(params: { p_neighborhood_id: number }): Promise<NeighborhoodBboxRow | null> {
    const { data, error } = await supabase.rpc("get_neighborhood_bbox", params);
    if (error) throw error;
    return (data as NeighborhoodBboxRow[] | null)?.[0] ?? null;
}

export async function getNeighborhoodGeojson(params: { p_id: number }): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_neighborhood_geojson", params);
    if (error) throw error;
    return data as string | null;
}

export async function getMsaBbox(params: { p_geoid: string }): Promise<MsaBboxRow | null> {
    const { data, error } = await supabase.rpc("get_msa_bbox", params);
    if (error) throw error;
    return (data as MsaBboxRow[] | null)?.[0] ?? null;
}

export async function getMsaGeojson(params: { p_geoid: string }): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_msa_geojson", params);
    if (error) throw error;
    return data as string | null;
}

export async function getCityGeojson(params: { p_name: string; p_state: string }): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_city_geojson", params);
    if (error) throw error;
    return data as string | null;
}

export async function getCountyGeojson(params: { p_name: string; p_state: string }): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_county_geojson", params);
    if (error) throw error;
    return data as string | null;
}

export async function getAdjacentNeighborhoodsBatch(params: { p_ids: number[] }): Promise<NeighborhoodRow[]> {
    const { data, error } = await supabase.rpc("get_adjacent_neighborhoods_batch", params);
    if (error) throw error;
    return (data ?? []) as NeighborhoodRow[];
}

export async function findNeighborhood(params: { p_lng: number; p_lat: number }): Promise<NeighborhoodRow[]> {
    const { data, error } = await supabase.rpc("find_neighborhood", params);
    if (error) throw error;
    return (data ?? []) as NeighborhoodRow[];
}

export async function searchNeighborhoods(params: { p_query: string }): Promise<NeighborhoodAtPointRow[]> {
    const { data, error } = await supabase.rpc("search_neighborhoods", params);
    if (error) throw error;
    return (data ?? []) as NeighborhoodAtPointRow[];
}

export async function searchMsas(params: { p_query: string }): Promise<MsaRow[]> {
    const { data, error } = await supabase.rpc("search_msas", params);
    if (error) throw error;
    return (data ?? []) as MsaRow[];
}

export async function getNeighborhoodAtPoint(params: { p_lat: number; p_lng: number }): Promise<NeighborhoodAtPointRow[]> {
    const { data, error } = await supabase.rpc("get_neighborhood_at_point", params);
    if (error) throw error;
    return (data ?? []) as NeighborhoodAtPointRow[];
}

export async function getMsaAtPoint(params: { p_lat: number; p_lng: number }): Promise<MsaAtPointRow[]> {
    const { data, error } = await supabase.rpc("get_msa_at_point", params);
    if (error) throw error;
    return (data ?? []) as MsaAtPointRow[];
}
