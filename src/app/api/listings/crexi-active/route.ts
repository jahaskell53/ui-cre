import { and, desc, gte, ilike, isNotNull, lte, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crexiActiveListings } from "@/db/schema";

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

        const conditions: SQL[] = [isNotNull(crexiActiveListings.latitude), isNotNull(crexiActiveListings.longitude)];

        if (zipCode) {
            conditions.push(ilike(crexiActiveListings.zip, `%${zipCode}%`));
        } else if (cityName) {
            conditions.push(or(ilike(crexiActiveListings.city, `%${cityName}%`), ilike(crexiActiveListings.address, `%${cityName}%`))!);
        } else if (countyName) {
            conditions.push(or(ilike(crexiActiveListings.address, `%${countyName}%`), ilike(crexiActiveListings.city, `%${countyName}%`))!);
        } else if (addressQuery) {
            conditions.push(
                or(
                    ilike(crexiActiveListings.property_name, `%${addressQuery}%`),
                    ilike(crexiActiveListings.address, `%${addressQuery}%`),
                    ilike(crexiActiveListings.city, `%${addressQuery}%`),
                    ilike(crexiActiveListings.state, `%${addressQuery}%`),
                    ilike(crexiActiveListings.zip, `%${addressQuery}%`),
                )!,
            );
        }

        if (priceMin) {
            const v = parseFloat(priceMin);
            if (!Number.isNaN(v)) conditions.push(gte(crexiActiveListings.asking_price, v));
        }
        if (priceMax) {
            const v = parseFloat(priceMax);
            if (!Number.isNaN(v)) conditions.push(lte(crexiActiveListings.asking_price, v));
        }
        if (capRateMin) {
            const v = parseFloat(capRateMin);
            if (!Number.isNaN(v)) conditions.push(gte(crexiActiveListings.cap_rate, v));
        }
        if (capRateMax) {
            const v = parseFloat(capRateMax);
            if (!Number.isNaN(v)) conditions.push(lte(crexiActiveListings.cap_rate, v));
        }
        if (sqftMin) {
            const v = parseFloat(sqftMin);
            if (!Number.isNaN(v)) conditions.push(gte(crexiActiveListings.sqft, v));
        }
        if (sqftMax) {
            const v = parseFloat(sqftMax);
            if (!Number.isNaN(v)) conditions.push(lte(crexiActiveListings.sqft, v));
        }

        if (boundsWest && boundsEast && boundsSouth && boundsNorth) {
            const west = parseFloat(boundsWest);
            const east = parseFloat(boundsEast);
            const south = parseFloat(boundsSouth);
            const north = parseFloat(boundsNorth);
            if (!Number.isNaN(west) && !Number.isNaN(east) && !Number.isNaN(south) && !Number.isNaN(north)) {
                conditions.push(
                    and(
                        gte(crexiActiveListings.latitude, south),
                        lte(crexiActiveListings.latitude, north),
                        gte(crexiActiveListings.longitude, west),
                        lte(crexiActiveListings.longitude, east),
                    )!,
                );
            }
        }

        const rows = await db
            .select({
                id: crexiActiveListings.id,
                property_name: crexiActiveListings.property_name,
                address: crexiActiveListings.address,
                city: crexiActiveListings.city,
                state: crexiActiveListings.state,
                zip: crexiActiveListings.zip,
                asking_price: crexiActiveListings.asking_price,
                cap_rate: crexiActiveListings.cap_rate,
                sqft: crexiActiveListings.sqft,
                property_link: crexiActiveListings.property_link,
                latitude: crexiActiveListings.latitude,
                longitude: crexiActiveListings.longitude,
                created_at: crexiActiveListings.created_at,
            })
            .from(crexiActiveListings)
            .where(and(...conditions))
            .orderBy(desc(crexiActiveListings.created_at));

        return NextResponse.json({ data: rows, count: rows.length });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("Error in GET /api/listings/crexi-active:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
