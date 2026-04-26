import { and, desc, eq, gte, ilike, isNotNull, lte, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crexiApiComps } from "@/db/schema";

const crexiApiCompDetailColumns = {
    id: crexiApiComps.id,
    crexi_id: crexiApiComps.crexi_id,
    property_name: crexiApiComps.property_name,
    document_type: crexiApiComps.document_type,
    address_full: crexiApiComps.address_full,
    address_street: crexiApiComps.address_street,
    city: crexiApiComps.city,
    state: crexiApiComps.state,
    zip: crexiApiComps.zip,
    county: crexiApiComps.county,
    latitude: crexiApiComps.latitude,
    longitude: crexiApiComps.longitude,
    property_type: crexiApiComps.property_type,
    property_subtype: crexiApiComps.property_subtype,
    building_sqft: crexiApiComps.building_sqft,
    num_units: crexiApiComps.num_units,
    address_count: crexiApiComps.address_count,
    is_sales_comp: crexiApiComps.is_sales_comp,
    is_public_sales_comp: crexiApiComps.is_public_sales_comp,
    is_broker_reported_sales_comp: crexiApiComps.is_broker_reported_sales_comp,
    is_lease_comp: crexiApiComps.is_lease_comp,
    sale_type: crexiApiComps.sale_type,
    days_on_market: crexiApiComps.days_on_market,
    date_activated: crexiApiComps.date_activated,
    date_updated: crexiApiComps.date_updated,
    description: crexiApiComps.description,
    scraped_at: crexiApiComps.scraped_at,
} as const;

/** Map overlay + single-record detail for `crexi_api_comps` (list: geo/sqft/area; detail: `id` query, no raw_json). */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const idParam = searchParams.get("id");
        if (idParam) {
            const idNum = parseInt(idParam, 10);
            if (Number.isNaN(idNum)) {
                return NextResponse.json({ error: "Invalid id" }, { status: 400 });
            }
            const rows = await db.select(crexiApiCompDetailColumns).from(crexiApiComps).where(eq(crexiApiComps.id, idNum)).limit(1);
            if (rows.length === 0) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }
            return NextResponse.json(rows[0]);
        }

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
