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

export async function getRentTrends(params: BaseRentTrendsParams & { p_zip: string }): Promise<RentTrendRow[]> {
    return rpc("get_rent_trends", params);
}

export async function getRentTrendsByNeighborhood(params: BaseRentTrendsParams & { p_neighborhood_ids: number[] }): Promise<RentTrendRow[]> {
    return rpc("get_rent_trends_by_neighborhood", params);
}

export async function getRentTrendsByCity(params: BaseRentTrendsParams & { p_city: string; p_state: string }): Promise<RentTrendRow[]> {
    return rpc("get_rent_trends_by_city", params);
}

export async function getRentTrendsByCounty(params: BaseRentTrendsParams & { p_county_name: string; p_state: string }): Promise<RentTrendRow[]> {
    return rpc("get_rent_trends_by_county", params);
}

export async function getRentTrendsByMsa(params: BaseRentTrendsParams & { p_geoid: string }): Promise<RentTrendRow[]> {
    return rpc("get_rent_trends_by_msa", params);
}
