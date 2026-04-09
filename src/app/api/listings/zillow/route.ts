import { NextRequest, NextResponse } from "next/server";
import { type ZillowMapListingRow } from "@/lib/map-listings";
import { createAdminClient } from "@/utils/supabase/admin";

const RPC_PAGE_SIZE = 1000;

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
            p_property_type: (sp.get("property_type") ?? "both") as "both" | "reit" | "mid",
            // Bounds are snapped to a 0.1° grid (~11 km) so nearby viewports share the same
            // cached response. Client-side filterToViewport() then trims to the exact viewport.
            p_bounds_south: sp.has("bounds_south") ? Math.floor(parseFloat(sp.get("bounds_south")!) * 10) / 10 : null,
            p_bounds_north: sp.has("bounds_north") ? Math.ceil(parseFloat(sp.get("bounds_north")!) * 10) / 10 : null,
            p_bounds_west: sp.has("bounds_west") ? Math.floor(parseFloat(sp.get("bounds_west")!) * 10) / 10 : null,
            p_bounds_east: sp.has("bounds_east") ? Math.ceil(parseFloat(sp.get("bounds_east")!) * 10) / 10 : null,
        };

        const t0 = performance.now();
        const supabase = createAdminClient();
        const tClientReady = performance.now();

        const serverTiming = (rpcDoneAt: number, extraMs?: string) =>
            [
                `client;dur=${(tClientReady - t0).toFixed(1)};desc="Admin client init"`,
                `rpc;dur=${(rpcDoneAt - tClientReady).toFixed(1)};desc="PostgREST RPC"`,
                ...(extraMs ? [`serialize;dur=${extraMs};desc="JSON serialize"`] : []),
                `total;dur=${(performance.now() - t0).toFixed(1)};desc="Total"`,
            ].join(", ");

        const rows: ZillowMapListingRow[] = [];
        let nextOffset = 0;

        while (true) {
            const { data, error } = await supabase.rpc("get_zillow_map_listings", {
                ...params,
                p_limit: RPC_PAGE_SIZE,
                p_offset: nextOffset,
            });
            if (error) {
                const tRpcDone = performance.now();
                return NextResponse.json({ error: error.message }, { status: 500, headers: { "Server-Timing": serverTiming(tRpcDone) } });
            }

            const pageRows = (data ?? []) as ZillowMapListingRow[];
            if (pageRows.length === 0) {
                break;
            }

            rows.push(...pageRows);
            const totalCount = Number(pageRows[0]?.total_count);
            if (!Number.isFinite(totalCount) || totalCount < 0) {
                throw new Error("Invalid total_count from get_zillow_map_listings");
            }
            if (rows.length >= totalCount) {
                break;
            }

            nextOffset = rows.length;
        }

        const tRpcDone = performance.now();

        const tSerialize = performance.now();

        return NextResponse.json(rows, {
            headers: {
                "Cache-Control": "public, s-maxage=259200, stale-while-revalidate=43200",
                "Server-Timing": serverTiming(tRpcDone, (tSerialize - tRpcDone).toFixed(1)),
            },
        });
    } catch (error: any) {
        console.error("Error in GET /api/listings/zillow:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
