export interface SalesTrendRow {
    month_start: string;
    median_price: number;
    avg_cap_rate: number | null;
    listing_count: number;
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

export async function getSalesTrends(params: { p_zip: string }): Promise<SalesTrendRow[]> {
    return rpc("get_sales_trends", params);
}

export async function getSalesTrendsByNeighborhood(params: { p_neighborhood_ids: number[] }): Promise<SalesTrendRow[]> {
    return rpc("get_sales_trends_by_neighborhood", params);
}

export async function getSalesTrendsByCity(params: { p_city: string; p_state: string }): Promise<SalesTrendRow[]> {
    return rpc("get_sales_trends_by_city", params);
}

export async function getSalesTrendsByCounty(params: { p_county_name: string; p_state: string }): Promise<SalesTrendRow[]> {
    return rpc("get_sales_trends_by_county", params);
}

export async function getSalesTrendsByMsa(params: { p_geoid: string }): Promise<SalesTrendRow[]> {
    return rpc("get_sales_trends_by_msa", params);
}

// ── Crexi API comps variants ─────────────────────────────────────────────────

export async function getCrexiSalesTrends(params: { p_zip: string }): Promise<SalesTrendRow[]> {
    return rpc("get_crexi_sales_trends", params);
}

export async function getCrexiSalesTrendsByNeighborhood(params: { p_neighborhood_ids: number[] }): Promise<SalesTrendRow[]> {
    return rpc("get_crexi_sales_trends_by_neighborhood", params);
}

export async function getCrexiSalesTrendsByCity(params: { p_city: string; p_state: string }): Promise<SalesTrendRow[]> {
    return rpc("get_crexi_sales_trends_by_city", params);
}

export async function getCrexiSalesTrendsByCounty(params: { p_county_name: string; p_state: string }): Promise<SalesTrendRow[]> {
    return rpc("get_crexi_sales_trends_by_county", params);
}

export async function getCrexiSalesTrendsByMsa(params: { p_geoid: string }): Promise<SalesTrendRow[]> {
    return rpc("get_crexi_sales_trends_by_msa", params);
}

// ── Crexi v2 variants (unit filters + extended price columns) ───────────────

export interface SalesTrendRowV2 extends SalesTrendRow {
    avg_price: number;
    p25_price: number;
    p75_price: number;
    min_price: number;
    max_price: number;
}

interface UnitFilterParams {
    p_min_units?: number | null;
    p_max_units?: number | null;
}

export async function getCrexiSalesTrendsV2(params: { p_zip: string } & UnitFilterParams): Promise<SalesTrendRowV2[]> {
    return rpc("get_crexi_sales_trends_v2", params);
}

export async function getCrexiSalesTrendsByNeighborhoodV2(params: { p_neighborhood_ids: number[] } & UnitFilterParams): Promise<SalesTrendRowV2[]> {
    return rpc("get_crexi_sales_trends_by_neighborhood_v2", params);
}

export async function getCrexiSalesTrendsByCityV2(params: { p_city: string; p_state: string } & UnitFilterParams): Promise<SalesTrendRowV2[]> {
    return rpc("get_crexi_sales_trends_by_city_v2", params);
}

export async function getCrexiSalesTrendsByCountyV2(params: { p_county_name: string; p_state: string } & UnitFilterParams): Promise<SalesTrendRowV2[]> {
    return rpc("get_crexi_sales_trends_by_county_v2", params);
}

export async function getCrexiSalesTrendsByMsaV2(params: { p_geoid: string } & UnitFilterParams): Promise<SalesTrendRowV2[]> {
    return rpc("get_crexi_sales_trends_by_msa_v2", params);
}
