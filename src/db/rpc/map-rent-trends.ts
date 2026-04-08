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

async function rpc<T>(fn: string, params: object): Promise<T[]> {
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

export async function getMapRentTrends(params: BaseMapRentTrendsParams): Promise<MapRentTrendZipRow[]> {
    return rpc("get_map_rent_trends", params);
}

export async function getMapRentTrendsByNeighborhood(params: BaseMapRentTrendsParams): Promise<MapRentTrendNeighborhoodRow[]> {
    return rpc("get_map_rent_trends_by_neighborhood", params);
}

export async function getMapRentTrendsByCounty(params: BaseMapRentTrendsParams): Promise<MapRentTrendCountyRow[]> {
    return rpc("get_map_rent_trends_by_county", params);
}

export async function getMapRentTrendsByMsa(params: BaseMapRentTrendsParams): Promise<MapRentTrendMsaRow[]> {
    return rpc("get_map_rent_trends_by_msa", params);
}

export async function getMapRentTrendsByCity(params: BaseMapRentTrendsParams): Promise<MapRentTrendCityRow[]> {
    return rpc("get_map_rent_trends_by_city", params);
}
