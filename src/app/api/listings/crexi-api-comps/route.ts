import { and, desc, gte, ilike, isNotNull, lte, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crexiApiComps } from "@/db/schema";

/** Map overlay for `crexi_api_comps` (no price/cap columns — sqft and geo filters only). */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const zipCode = searchParams.get("zip");
        const cityName = searchParams.get("city");
        const countyName = searchParams.get("county");
        const addressQuery = searchParams.get("address_query");
        const sqftMin = searchParams.get("sqft_min");
        const sqftMax = searchParams.get("sqft_max");
        const boundsWest = searchParams.get("bounds_west");
        const boundsEast = searchParams.get("bounds_east");
        const boundsSouth = searchParams.get("bounds_south");
        const boundsNorth = searchParams.get("bounds_north");

        const conditions: SQL[] = [isNotNull(crexiApiComps.latitude), isNotNull(crexiApiComps.longitude)];

        if (zipCode) {
            conditions.push(ilike(crexiApiComps.zip, `%${zipCode}%`));
        } else if (cityName) {
            conditions.push(or(ilike(crexiApiComps.city, `%${cityName}%`), ilike(crexiApiComps.address_full, `%${cityName}%`))!);
        } else if (countyName) {
            conditions.push(
                or(
                    ilike(crexiApiComps.county, `%${countyName}%`),
                    ilike(crexiApiComps.address_full, `%${countyName}%`),
                    ilike(crexiApiComps.city, `%${countyName}%`),
                )!,
            );
        } else if (addressQuery) {
            conditions.push(
                or(
                    ilike(crexiApiComps.property_name, `%${addressQuery}%`),
                    ilike(crexiApiComps.address_full, `%${addressQuery}%`),
                    ilike(crexiApiComps.address_street, `%${addressQuery}%`),
                    ilike(crexiApiComps.city, `%${addressQuery}%`),
                    ilike(crexiApiComps.state, `%${addressQuery}%`),
                    ilike(crexiApiComps.zip, `%${addressQuery}%`),
                )!,
            );
        }

        if (sqftMin) {
            const v = parseFloat(sqftMin);
            if (!Number.isNaN(v)) conditions.push(gte(crexiApiComps.building_sqft, Math.round(v)));
        }
        if (sqftMax) {
            const v = parseFloat(sqftMax);
            if (!Number.isNaN(v)) conditions.push(lte(crexiApiComps.building_sqft, Math.round(v)));
        }

        if (boundsWest && boundsEast && boundsSouth && boundsNorth) {
            const west = parseFloat(boundsWest);
            const east = parseFloat(boundsEast);
            const south = parseFloat(boundsSouth);
            const north = parseFloat(boundsNorth);
            if (!Number.isNaN(west) && !Number.isNaN(east) && !Number.isNaN(south) && !Number.isNaN(north)) {
                conditions.push(
                    and(
                        gte(crexiApiComps.latitude, south),
                        lte(crexiApiComps.latitude, north),
                        gte(crexiApiComps.longitude, west),
                        lte(crexiApiComps.longitude, east),
                    )!,
                );
            }
        }

        const rows = await db
            .select({
                id: crexiApiComps.id,
                crexi_id: crexiApiComps.crexi_id,
                property_name: crexiApiComps.property_name,
                address_full: crexiApiComps.address_full,
                address_street: crexiApiComps.address_street,
                city: crexiApiComps.city,
                state: crexiApiComps.state,
                zip: crexiApiComps.zip,
                building_sqft: crexiApiComps.building_sqft,
                property_type: crexiApiComps.property_type,
                latitude: crexiApiComps.latitude,
                longitude: crexiApiComps.longitude,
                scraped_at: crexiApiComps.scraped_at,
            })
            .from(crexiApiComps)
            .where(and(...conditions))
            .orderBy(desc(crexiApiComps.scraped_at));

        return NextResponse.json({ data: rows, count: rows.length });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Error in GET /api/listings/crexi-api-comps:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
