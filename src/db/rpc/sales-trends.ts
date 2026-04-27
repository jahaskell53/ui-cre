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
