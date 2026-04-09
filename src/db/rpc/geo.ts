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

async function rpc<T>(fn: string, params: object): Promise<T> {
    const res = await fetch("/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fn, params }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
}

export async function getZipBoundary(params: { p_zip: string }): Promise<string | null> {
    return rpc("get_zip_boundary", params);
}

export async function getNeighborhoodBbox(params: { p_neighborhood_id: number }): Promise<NeighborhoodBboxRow | null> {
    const rows = await rpc<NeighborhoodBboxRow[]>("get_neighborhood_bbox", params);
    return rows?.[0] ?? null;
}

export async function getNeighborhoodGeojson(params: { p_id: number }): Promise<string | null> {
    return rpc("get_neighborhood_geojson", params);
}

export async function getMsaBbox(params: { p_geoid: string }): Promise<MsaBboxRow | null> {
    const rows = await rpc<MsaBboxRow[]>("get_msa_bbox", params);
    return rows?.[0] ?? null;
}

export async function getMsaGeojson(params: { p_geoid: string }): Promise<string | null> {
    return rpc("get_msa_geojson", params);
}

export async function getCityGeojson(params: { p_name: string; p_state: string }): Promise<string | null> {
    return rpc("get_city_geojson", params);
}

export async function getCountyGeojson(params: { p_name: string; p_state: string }): Promise<string | null> {
    return rpc("get_county_geojson", params);
}

export async function getAdjacentNeighborhoodsBatch(params: { p_ids: number[] }): Promise<NeighborhoodRow[]> {
    return rpc("get_adjacent_neighborhoods_batch", params);
}

export async function findNeighborhood(params: { p_lng: number; p_lat: number }): Promise<NeighborhoodRow[]> {
    return rpc("find_neighborhood", params);
}

export async function searchNeighborhoods(params: { p_query: string }): Promise<NeighborhoodAtPointRow[]> {
    return rpc("search_neighborhoods", params);
}

export async function searchMsas(params: { p_query: string }): Promise<MsaRow[]> {
    return rpc("search_msas", params);
}

export async function getNeighborhoodAtPoint(params: { p_lat: number; p_lng: number }): Promise<NeighborhoodAtPointRow[]> {
    return rpc("get_neighborhood_at_point", params);
}

export async function getMsaAtPoint(params: { p_lat: number; p_lng: number }): Promise<MsaAtPointRow[]> {
    return rpc("get_msa_at_point", params);
}
