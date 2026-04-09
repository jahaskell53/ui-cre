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

export async function getMarketActivity(params: BaseMarketActivityParams & { p_zip: string }): Promise<MarketActivityRow[]> {
    return rpc("get_market_activity", params);
}

export async function getMarketActivityByNeighborhood(params: BaseMarketActivityParams & { p_neighborhood_ids: number[] }): Promise<MarketActivityRow[]> {
    return rpc("get_market_activity_by_neighborhood", params);
}

export async function getMarketActivityByCity(params: BaseMarketActivityParams & { p_city: string; p_state: string }): Promise<MarketActivityRow[]> {
    return rpc("get_market_activity_by_city", params);
}

export async function getMarketActivityByCounty(params: BaseMarketActivityParams & { p_county_name: string; p_state: string }): Promise<MarketActivityRow[]> {
    return rpc("get_market_activity_by_county", params);
}

export async function getMarketActivityByMsa(params: BaseMarketActivityParams & { p_geoid: string }): Promise<MarketActivityRow[]> {
    return rpc("get_market_activity_by_msa", params);
}
