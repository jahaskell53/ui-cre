import { NextRequest, NextResponse } from "next/server";
import { type ZillowClusterRow, type ZillowMapListingRow } from "@/lib/map-listings";
import { createAdminClient } from "@/utils/supabase/admin";

const CLUSTER_ZOOM_THRESHOLD = 9;

const GRID_STEP_BY_ZOOM: Record<number, number> = {
    0: 5,
    1: 5,
    2: 2,
    3: 1,
    4: 0.5,
    5: 0.5,
    6: 0.2,
    7: 0.1,
    8: 0.1,
    9: 0.05,
};

function gridStepForZoom(zoom: number): number {
    const z = Math.max(0, Math.min(9, Math.floor(zoom)));
    return GRID_STEP_BY_ZOOM[z] ?? 0.1;
}

export async function GET(request: NextRequest) {
    try {
        const sp = request.nextUrl.searchParams;

        const zoom = sp.has("zoom") ? parseFloat(sp.get("zoom")!) : null;
        const useCluster = zoom !== null && zoom <= CLUSTER_ZOOM_THRESHOLD;

        const baseParams = {
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
            p_bounds_south: sp.has("bounds_south") ? Math.floor(parseFloat(sp.get("bounds_south")!) * 10) / 10 : null,
            p_bounds_north: sp.has("bounds_north") ? Math.ceil(parseFloat(sp.get("bounds_north")!) * 10) / 10 : null,
            p_bounds_west: sp.has("bounds_west") ? Math.floor(parseFloat(sp.get("bounds_west")!) * 10) / 10 : null,
            p_bounds_east: sp.has("bounds_east") ? Math.ceil(parseFloat(sp.get("bounds_east")!) * 10) / 10 : null,
        };

        const t0 = performance.now();
        const supabase = createAdminClient();
        const tClientReady = performance.now();

        const limit = sp.has("limit") ? parseInt(sp.get("limit")!, 10) : null;
        const offset = sp.has("offset") ? parseInt(sp.get("offset")!, 10) : 0;

        const serverTiming = (clientMs: string, rpcMs: string, extraMs?: string) =>
            [
                `client;dur=${clientMs};desc="Admin client init"`,
                `rpc;dur=${rpcMs};desc="PostgREST RPC"`,
                ...(extraMs ? [`serialize;dur=${extraMs};desc="JSON serialize"`] : []),
                `total;dur=${(performance.now() - t0).toFixed(1)};desc="Total"`,
            ].join(", ");

        if (useCluster) {
            const sidebarLimit = limit ?? 50;
            const [clusterResult, listingsResult] = await Promise.all([
                supabase.rpc("get_zillow_map_clusters", {
                    ...baseParams,
                    p_grid_step: gridStepForZoom(zoom),
                }),
                supabase.rpc("get_zillow_map_listings", {
                    ...baseParams,
                    p_limit: sidebarLimit,
                    p_offset: offset,
                }),
            ]);
            const tRpcDone = performance.now();
            const clientMs = (tClientReady - t0).toFixed(1);
            const rpcMs = (tRpcDone - tClientReady).toFixed(1);

            if (clusterResult.error) {
                return NextResponse.json({ error: clusterResult.error.message }, { status: 500, headers: { "Server-Timing": serverTiming(clientMs, rpcMs) } });
            }
            if (listingsResult.error) {
                return NextResponse.json({ error: listingsResult.error.message }, { status: 500, headers: { "Server-Timing": serverTiming(clientMs, rpcMs) } });
            }

            const clusters = (clusterResult.data ?? []) as ZillowClusterRow[];
            const listings = (listingsResult.data ?? []) as ZillowMapListingRow[];
            const totalCount = listings.length > 0 ? listings[0].total_count : clusters.reduce((s, c) => s + c.point_count, 0);
            const tSerialize = performance.now();

            return NextResponse.json(
                { mode: "clusters" as const, data: clusters, listings, total_count: totalCount },
                {
                    headers: {
                        "Cache-Control": "public, s-maxage=259200, stale-while-revalidate=43200",
                        "Server-Timing": serverTiming(clientMs, rpcMs, (tSerialize - tRpcDone).toFixed(1)),
                    },
                },
            );
        }

        const listingsParams = { ...baseParams, ...(limit != null ? { p_limit: limit, p_offset: offset } : {}) };
        const result = await supabase.rpc("get_zillow_map_listings", listingsParams);
        const tRpcDone = performance.now();
        const clientMs = (tClientReady - t0).toFixed(1);
        const rpcMs = (tRpcDone - tClientReady).toFixed(1);

        if (result.error) {
            return NextResponse.json({ error: result.error.message }, { status: 500, headers: { "Server-Timing": serverTiming(clientMs, rpcMs) } });
        }

        const rows = (result.data ?? []) as ZillowMapListingRow[];
        const tSerialize = performance.now();

        return NextResponse.json(
            { mode: "pins" as const, data: rows },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=259200, stale-while-revalidate=43200",
                    "Server-Timing": serverTiming(clientMs, rpcMs, (tSerialize - tRpcDone).toFixed(1)),
                },
            },
        );
    } catch (error: any) {
        console.error("Error in GET /api/listings/zillow:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
