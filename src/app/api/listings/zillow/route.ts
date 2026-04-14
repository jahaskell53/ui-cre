import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { type ZillowMapListingRow } from "@/lib/map-listings";

const ZILLOW_MAP_RPC_MAX_ATTEMPTS = 3;
const ZILLOW_MAP_CACHE_CONTROL = "public, s-maxage=604800, stale-while-revalidate=86400";

function isStatementTimeoutMessage(message: string): boolean {
    const m = message.toLowerCase();
    return m.includes("statement timeout") || m.includes("57014");
}

async function callZillowMapListingsRpc(params: {
    p_zip: string | null;
    p_city: string | null;
    p_address_query: string | null;
    p_latest_only: boolean;
    p_price_min: number | null;
    p_price_max: number | null;
    p_sqft_min: number | null;
    p_sqft_max: number | null;
    p_beds: number[] | null;
    p_baths_min: number | null;
    p_home_types: string[] | null;
    p_property_type: string;
    p_laundry: string[] | null;
    p_bounds_south: number | null;
    p_bounds_north: number | null;
    p_bounds_west: number | null;
    p_bounds_east: number | null;
}): Promise<ZillowMapListingRow[]> {
    // Call the function directly via Drizzle (postgres.js), bypassing PostgREST's
    // max_rows limit so all matching listings are returned regardless of viewport size.
    const rows = await db.execute<{
        id: string;
        address: string;
        longitude: number;
        latitude: number;
        price_label: string;
        is_reit: boolean;
        unit_count: number;
        unit_mix: { beds: number; baths: number | null; count: number; avg_price: number | null }[];
        img_src: string | null;
        area: number | null;
        scraped_at: string | null;
        building_zpid: string | null;
        total_count: number;
    }>(sql`
        SELECT
            id,
            address,
            longitude,
            latitude,
            price_label,
            is_reit,
            unit_count,
            unit_mix,
            img_src,
            area,
            scraped_at::text          AS scraped_at,
            building_zpid,
            total_count::integer      AS total_count
        FROM get_zillow_map_listings(
            ${params.p_zip}::text,
            ${params.p_city}::text,
            ${params.p_address_query}::text,
            ${params.p_latest_only}::boolean,
            ${params.p_price_min}::integer,
            ${params.p_price_max}::integer,
            ${params.p_sqft_min}::integer,
            ${params.p_sqft_max}::integer,
            ${params.p_beds}::integer[],
            ${params.p_baths_min}::numeric,
            ${params.p_home_types}::text[],
            ${params.p_property_type}::text,
            ${params.p_laundry}::text[],
            ${params.p_bounds_south}::double precision,
            ${params.p_bounds_north}::double precision,
            ${params.p_bounds_west}::double precision,
            ${params.p_bounds_east}::double precision
        )
    `);
    return rows as ZillowMapListingRow[];
}

async function callZillowMapListingsRpcWithRetry(
    params: Parameters<typeof callZillowMapListingsRpc>[0],
): Promise<ZillowMapListingRow[]> {
    let lastError: unknown;

    for (let attempt = 0; attempt < ZILLOW_MAP_RPC_MAX_ATTEMPTS; attempt++) {
        try {
            return await callZillowMapListingsRpc(params);
        } catch (err) {
            lastError = err;
            const message = err instanceof Error ? err.message : String(err);
            if (!isStatementTimeoutMessage(message)) {
                throw err;
            }
            if (attempt < ZILLOW_MAP_RPC_MAX_ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            }
        }
    }

    throw lastError;
}

export async function GET(request: NextRequest) {
    try {
        const sp = request.nextUrl.searchParams;

        const params = {
            p_zip: sp.get("zip"),
            p_city: sp.get("city"),
            p_address_query: sp.get("address_query"),
            p_latest_only: sp.get("latest_only") === "true",
            p_price_min: sp.has("price_min") ? parseFloat(sp.get("price_min")!) : null,
            p_price_max: sp.has("price_max") ? parseFloat(sp.get("price_max")!) : null,
            p_sqft_min: sp.has("sqft_min") ? parseFloat(sp.get("sqft_min")!) : null,
            p_sqft_max: sp.has("sqft_max") ? parseFloat(sp.get("sqft_max")!) : null,
            p_beds: sp.has("beds") ? sp.get("beds")!.split(",").map(Number) : null,
            p_baths_min: sp.has("baths_min") ? parseFloat(sp.get("baths_min")!) : null,
            p_home_types: sp.has("home_types") ? sp.get("home_types")!.split(",") : null,
            p_property_type: sp.get("property_type") ?? "both",
            p_laundry: (() => {
                const raw = sp.get("laundry");
                if (!raw) return null;
                const allowed = new Set(["in_unit", "shared", "none"]);
                const vals = raw
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => allowed.has(s));
                return vals.length > 0 ? vals : null;
            })(),
            // Bounds are snapped to a 0.1° grid (~11 km) so nearby viewports share the same
            // cached response. Client-side filterToViewport() then trims to the exact viewport.
            p_bounds_south: sp.has("bounds_south") ? Math.floor(parseFloat(sp.get("bounds_south")!) * 10) / 10 : null,
            p_bounds_north: sp.has("bounds_north") ? Math.ceil(parseFloat(sp.get("bounds_north")!) * 10) / 10 : null,
            p_bounds_west: sp.has("bounds_west") ? Math.floor(parseFloat(sp.get("bounds_west")!) * 10) / 10 : null,
            p_bounds_east: sp.has("bounds_east") ? Math.ceil(parseFloat(sp.get("bounds_east")!) * 10) / 10 : null,
        };

        const t0 = performance.now();
        const rows = await callZillowMapListingsRpcWithRetry(params);
        const tRpcDone = performance.now();
        const rpcMs = (tRpcDone - t0).toFixed(1);

        const serverTiming = (extraMs?: string) =>
            [
                `rpc;dur=${rpcMs};desc="Postgres RPC"`,
                ...(extraMs ? [`serialize;dur=${extraMs};desc="JSON serialize"`] : []),
                `total;dur=${(performance.now() - t0).toFixed(1)};desc="Total"`,
            ].join(", ");

        const tSerialize = performance.now();

        return NextResponse.json(rows, {
            headers: {
                "Cache-Control": ZILLOW_MAP_CACHE_CONTROL,
                "Server-Timing": serverTiming((tSerialize - tRpcDone).toFixed(1)),
            },
        });
    } catch (error: any) {
        console.error("Error in GET /api/listings/zillow:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
