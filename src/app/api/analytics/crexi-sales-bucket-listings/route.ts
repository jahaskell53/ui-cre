import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE_MAX = 200;

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const sp = request.nextUrl.searchParams;
        const areaKind = sp.get("areaKind");
        const bucketStart = sp.get("bucketStart");
        if (!areaKind || !bucketStart) {
            return NextResponse.json({ error: "Missing areaKind or bucketStart" }, { status: 400 });
        }

        const monthsPerBucket = Math.max(1, parseInt(sp.get("monthsPerBucket") ?? "1", 10) || 1);
        const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
        const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(sp.get("limit") ?? "25", 10) || 25));

        const p_min_units = sp.get("minUnits") ? parseInt(sp.get("minUnits")!, 10) : null;
        const p_max_units = sp.get("maxUnits") ? parseInt(sp.get("maxUnits")!, 10) : null;

        const params: Record<string, unknown> = {
            p_area_kind: areaKind,
            p_bucket_start: bucketStart,
            p_months_per_bucket: monthsPerBucket,
            p_offset: offset,
            p_limit: limit,
            p_zip: sp.get("zip") ?? null,
            p_city: sp.get("city") ?? null,
            p_state: sp.get("state") ?? null,
            p_county_name: sp.get("countyName") ?? null,
            p_geoid: sp.get("geoid") ?? null,
            p_neighborhood_ids: sp.get("neighborhoodIds")
                ? sp
                      .get("neighborhoodIds")!
                      .split(",")
                      .map((s) => parseInt(s.trim(), 10))
                      .filter((n) => !isNaN(n))
                : null,
            p_min_units: Number.isFinite(p_min_units as number) ? p_min_units : null,
            p_max_units: Number.isFinite(p_max_units as number) ? p_max_units : null,
        };

        const { data, error } = await supabase.rpc("get_crexi_sales_trends_bucket_listings", params);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (data ?? []) as Array<{
            total_count: number | string;
            id: number;
            crexi_id: string | null;
            property_name: string | null;
            address_full: string | null;
            city: string | null;
            state: string | null;
            zip: string | null;
            property_price_total: number | null;
            num_units: number | null;
            price_per_door: number | null;
            sale_transaction_date: string | null;
            sale_cap_rate_percent: number | null;
            financials_cap_rate_percent: number | null;
        }>;

        const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
        const listings = rows.map(({ total_count: _t, ...rest }) => rest);

        return NextResponse.json({ listings, total, offset, limit });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Internal server error";
        console.error("GET /api/analytics/crexi-sales-bucket-listings:", e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
