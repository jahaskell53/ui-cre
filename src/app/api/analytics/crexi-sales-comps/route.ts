import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { createClient } from "@/utils/supabase/server";

const PAGE_SIZE_MAX = 100;

export interface CrexiSalesCompRow {
    id: number;
    crexi_url: string | null;
    property_name: string | null;
    address_full: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    sale_transaction_date: string | null;
    property_price_total: number | null;
    num_units: number | null;
    price_per_door: number | null;
    cap_rate_percent: number | null;
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
        bucket_month_start?: string;
        sample_window_months?: number;
        period_cutoff?: string | null;
        p_zip?: string | null;
        p_city?: string | null;
        p_state?: string | null;
        p_county_name?: string | null;
        p_county_state?: string | null;
        p_neighborhood_ids?: number[] | null;
        p_msa_geoid?: string | null;
        p_min_units?: number | null;
        p_max_units?: number | null;
        limit?: number;
        offset?: number;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const bucket = body.bucket_month_start?.trim();
    if (!bucket || !/^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
        return NextResponse.json({ error: "bucket_month_start (YYYY-MM-DD) is required" }, { status: 400 });
    }

    const modes = [
        body.p_zip != null && body.p_zip !== "",
        body.p_city != null && body.p_state != null,
        body.p_county_name != null && body.p_county_state != null,
        body.p_neighborhood_ids != null && body.p_neighborhood_ids.length > 0,
        body.p_msa_geoid != null && body.p_msa_geoid !== "",
    ].filter(Boolean).length;
    if (modes !== 1) {
        return NextResponse.json(
            { error: "Specify exactly one geographic scope (zip, city+state, county+state, neighborhood ids, or MSA geoid)" },
            { status: 400 },
        );
    }

    const win = body.sample_window_months ?? 1;
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), PAGE_SIZE_MAX);
    const offset = Math.max(Number(body.offset) || 0, 0);

    const nhLiteral =
        body.p_neighborhood_ids && body.p_neighborhood_ids.length > 0 ? `{${body.p_neighborhood_ids.map((id) => Math.floor(Number(id))).join(",")}}` : null;

    const rows = await db.execute<{ result: unknown }>(sql`
        SELECT list_crexi_sales_comps_for_chart_bucket(
            ${bucket}::date,
            ${win}::integer,
            ${body.p_zip ?? null}::text,
            ${body.p_city ?? null}::text,
            ${body.p_state ?? null}::text,
            ${body.p_county_name ?? null}::text,
            ${body.p_county_state ?? null}::text,
            ${nhLiteral}::integer[],
            ${body.p_msa_geoid ?? null}::text,
            ${body.p_min_units ?? null}::integer,
            ${body.p_max_units ?? null}::integer,
            ${body.period_cutoff ?? null}::date,
            ${limit}::integer,
            ${offset}::integer
        ) AS result
    `);

    const raw = rows[0]?.result;
    let payload: { total?: unknown; rows?: unknown };
    if (raw == null) {
        return NextResponse.json({ total: 0, rows: [] satisfies CrexiSalesCompRow[] });
    }
    if (typeof raw === "string") {
        try {
            payload = JSON.parse(raw) as { total?: unknown; rows?: unknown };
        } catch {
            return NextResponse.json({ total: 0, rows: [] satisfies CrexiSalesCompRow[] });
        }
    } else if (typeof raw === "object") {
        payload = raw as { total?: unknown; rows?: unknown };
    } else {
        return NextResponse.json({ total: 0, rows: [] satisfies CrexiSalesCompRow[] });
    }

    const total = typeof payload.total === "number" ? payload.total : Number(payload.total ?? 0);
    const rowList = Array.isArray(payload.rows) ? payload.rows : [];

    return NextResponse.json({
        total: Number.isFinite(total) ? total : 0,
        rows: rowList as CrexiSalesCompRow[],
    });
}
