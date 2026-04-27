export interface MapSalesTrendZipRow {
    zip: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

export interface MapSalesTrendNeighborhoodRow {
    neighborhood_id: number;
    name: string;
    city: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

export interface MapSalesTrendCityRow {
    city_name: string;
    state: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

export interface MapSalesTrendCountyRow {
    county_name: string;
    state: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

export interface MapSalesTrendMsaRow {
    geoid: string;
    name: string;
    geom_json: string;
    current_median: number;
    prior_median: number;
    pct_change: number | null;
    listing_count: number;
}

interface BaseMapSalesTrendsParams {
    p_months_back: number;
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

// ── LoopNet variants ──────────────────────────────────────────────────────────

export async function getMapSalesTrends(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendZipRow[]> {
    return rpc("get_map_sales_trends", params);
}

export async function getMapSalesTrendsByNeighborhood(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendNeighborhoodRow[]> {
    return rpc("get_map_sales_trends_by_neighborhood", params);
}

export async function getMapSalesTrendsByCity(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendCityRow[]> {
    return rpc("get_map_sales_trends_by_city", params);
}

export async function getMapSalesTrendsByCounty(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendCountyRow[]> {
    return rpc("get_map_sales_trends_by_county", params);
}

export async function getMapSalesTrendsByMsa(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendMsaRow[]> {
    return rpc("get_map_sales_trends_by_msa", params);
}

// ── Crexi variants ────────────────────────────────────────────────────────────

export async function getMapCrexiSalesTrends(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendZipRow[]> {
    return rpc("get_map_crexi_sales_trends", params);
}

export async function getMapCrexiSalesTrendsByNeighborhood(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendNeighborhoodRow[]> {
    return rpc("get_map_crexi_sales_trends_by_neighborhood", params);
}

export async function getMapCrexiSalesTrendsByCity(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendCityRow[]> {
    return rpc("get_map_crexi_sales_trends_by_city", params);
}

export async function getMapCrexiSalesTrendsByCounty(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendCountyRow[]> {
    return rpc("get_map_crexi_sales_trends_by_county", params);
}

export async function getMapCrexiSalesTrendsByMsa(params: BaseMapSalesTrendsParams): Promise<MapSalesTrendMsaRow[]> {
    return rpc("get_map_crexi_sales_trends_by_msa", params);
}
