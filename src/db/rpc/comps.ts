export interface CompRow {
    id: string;
    address_raw: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
    price: number | null;
    beds: number | null;
    baths: number | null;
    area: number | null;
    distance_m: number;
    composite_score: number;
    building_zpid: string | null;
    unit_count: number;
}

export interface GetCompsParams {
    subject_lng: number;
    subject_lat: number;
    radius_m: number;
    subject_price: number | null;
    subject_beds: number | null;
    subject_baths: number | null;
    subject_area: number | null;
    p_segment: "mid" | "reit" | "both";
    p_limit: number;
    p_neighborhood_ids: number[] | null;
    p_neighborhood_id: number | null;
    p_subject_zip: string | null;
    p_home_type: string | null;
}

export async function getComps(params: GetCompsParams): Promise<CompRow[]> {
    const res = await fetch("/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fn: "get_comps", params }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
}
