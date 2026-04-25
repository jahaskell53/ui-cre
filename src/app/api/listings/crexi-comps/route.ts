import { and, desc, gte, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crexiCompsRecords } from "@/db/schema";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const zipCode = searchParams.get("zip");
        const cityName = searchParams.get("city");
        const countyName = searchParams.get("county");
        const addressQuery = searchParams.get("address_query");
        const priceMin = searchParams.get("price_min");
        const priceMax = searchParams.get("price_max");
        const capRateMin = searchParams.get("cap_rate_min");
        const capRateMax = searchParams.get("cap_rate_max");
        const sqftMin = searchParams.get("sqft_min");
        const sqftMax = searchParams.get("sqft_max");
        const boundsWest = searchParams.get("bounds_west");
        const boundsEast = searchParams.get("bounds_east");
        const boundsSouth = searchParams.get("bounds_south");
        const boundsNorth = searchParams.get("bounds_north");

        const conditions: SQL[] = [isNotNull(crexiCompsRecords.latitude), isNotNull(crexiCompsRecords.longitude)];

        if (zipCode) {
            conditions.push(ilike(crexiCompsRecords.zip_code, `%${zipCode}%`));
        } else if (cityName) {
            conditions.push(or(ilike(crexiCompsRecords.city, `%${cityName}%`), ilike(crexiCompsRecords.address, `%${cityName}%`))!);
        } else if (countyName) {
            conditions.push(
                or(
                    ilike(crexiCompsRecords.county, `%${countyName}%`),
                    ilike(crexiCompsRecords.address, `%${countyName}%`),
                    ilike(crexiCompsRecords.city, `%${countyName}%`),
                )!,
            );
        } else if (addressQuery) {
            conditions.push(
                or(
                    ilike(crexiCompsRecords.property_name, `%${addressQuery}%`),
                    ilike(crexiCompsRecords.address, `%${addressQuery}%`),
                    ilike(crexiCompsRecords.city, `%${addressQuery}%`),
                    ilike(crexiCompsRecords.state, `%${addressQuery}%`),
                    ilike(crexiCompsRecords.zip_code, `%${addressQuery}%`),
                )!,
            );
        }

        if (priceMin) {
            const v = parseFloat(priceMin);
            if (!Number.isNaN(v)) conditions.push(gte(crexiCompsRecords.sold_price, v));
        }
        if (priceMax) {
            const v = parseFloat(priceMax);
            if (!Number.isNaN(v)) conditions.push(lte(crexiCompsRecords.sold_price, v));
        }

        const capExpr = sql<number>`coalesce(${crexiCompsRecords.closing_cap_rate}, ${crexiCompsRecords.asking_cap_rate})`;
        if (capRateMin) {
            const v = parseFloat(capRateMin);
            if (!Number.isNaN(v)) conditions.push(gte(capExpr, v));
        }
        if (capRateMax) {
            const v = parseFloat(capRateMax);
            if (!Number.isNaN(v)) conditions.push(lte(capExpr, v));
        }

        if (sqftMin) {
            const v = parseFloat(sqftMin);
            if (!Number.isNaN(v)) conditions.push(gte(crexiCompsRecords.building_sqft, v));
        }
        if (sqftMax) {
            const v = parseFloat(sqftMax);
            if (!Number.isNaN(v)) conditions.push(lte(crexiCompsRecords.building_sqft, v));
        }

        if (boundsWest && boundsEast && boundsSouth && boundsNorth) {
            const west = parseFloat(boundsWest);
            const east = parseFloat(boundsEast);
            const south = parseFloat(boundsSouth);
            const north = parseFloat(boundsNorth);
            if (!Number.isNaN(west) && !Number.isNaN(east) && !Number.isNaN(south) && !Number.isNaN(north)) {
                conditions.push(
                    and(
                        gte(crexiCompsRecords.latitude, south),
                        lte(crexiCompsRecords.latitude, north),
                        gte(crexiCompsRecords.longitude, west),
                        lte(crexiCompsRecords.longitude, east),
                    )!,
                );
            }
        }

        const rows = await db
            .select({
                id: crexiCompsRecords.id,
                property_name: crexiCompsRecords.property_name,
                address: crexiCompsRecords.address,
                city: crexiCompsRecords.city,
                state: crexiCompsRecords.state,
                zip_code: crexiCompsRecords.zip_code,
                sold_price: crexiCompsRecords.sold_price,
                closing_cap_rate: crexiCompsRecords.closing_cap_rate,
                asking_cap_rate: crexiCompsRecords.asking_cap_rate,
                building_sqft: crexiCompsRecords.building_sqft,
                property_link: crexiCompsRecords.property_link,
                latitude: crexiCompsRecords.latitude,
                longitude: crexiCompsRecords.longitude,
                created_at: crexiCompsRecords.created_at,
            })
            .from(crexiCompsRecords)
            .where(and(...conditions))
            .orderBy(desc(crexiCompsRecords.created_at));

        return NextResponse.json({ data: rows, count: rows.length });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Error in GET /api/listings/crexi-comps:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
