import { and, count, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cleanedListings } from "@/db/schema";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const id = searchParams.get("id");
        const buildingZpid = searchParams.get("building_zpid");
        const idsParam = searchParams.get("ids");
        const zpid = searchParams.get("zpid");
        const latestRunId = searchParams.get("latest_run_id");
        const countOnly = searchParams.get("count_only");
        const latestScrapedAt = searchParams.get("latest_scraped_at");
        const runId = searchParams.get("run_id");
        const zpidBuilding = searchParams.get("zpid_building");

        // Fetch the building row (is_building=true) by its zpid value
        if (zpidBuilding && zpid) {
            const rows = await db
                .select({
                    id: cleanedListings.id,
                    zpid: cleanedListings.zpid,
                    rawScrapeId: cleanedListings.rawScrapeId,
                    imgSrc: cleanedListings.imgSrc,
                    detailUrl: cleanedListings.detailUrl,
                    addressRaw: cleanedListings.addressRaw,
                    addressStreet: cleanedListings.addressStreet,
                    addressCity: cleanedListings.addressCity,
                    addressState: cleanedListings.addressState,
                    addressZip: cleanedListings.addressZip,
                    price: cleanedListings.price,
                    beds: cleanedListings.beds,
                    baths: cleanedListings.baths,
                    area: cleanedListings.area,
                    availabilityDate: cleanedListings.availabilityDate,
                    scrapedAt: cleanedListings.scrapedAt,
                    latitude: cleanedListings.latitude,
                    longitude: cleanedListings.longitude,
                    isBuilding: cleanedListings.isBuilding,
                    buildingZpid: cleanedListings.buildingZpid,
                    homeType: cleanedListings.homeType,
                    laundry: cleanedListings.laundry,
                })
                .from(cleanedListings)
                .where(and(eq(cleanedListings.zpid, zpid), eq(cleanedListings.isBuilding, true)))
                .orderBy(desc(cleanedListings.scrapedAt))
                .limit(1);

            if (rows.length === 0) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }

            const r = rows[0];
            return NextResponse.json({
                id: r.id,
                zpid: r.zpid,
                raw_scrape_id: r.rawScrapeId,
                img_src: r.imgSrc,
                detail_url: r.detailUrl,
                address_raw: r.addressRaw,
                address_street: r.addressStreet,
                address_city: r.addressCity,
                address_state: r.addressState,
                address_zip: r.addressZip,
                price: r.price,
                beds: r.beds,
                baths: r.baths,
                area: r.area,
                availability_date: r.availabilityDate,
                scraped_at: r.scrapedAt,
                latitude: r.latitude,
                longitude: r.longitude,
                is_building: r.isBuilding,
                building_zpid: r.buildingZpid,
                home_type: r.homeType,
                laundry: r.laundry,
            });
        }

        // Get latest run_id
        if (latestRunId === "1") {
            const rows = await db.select({ runId: cleanedListings.runId }).from(cleanedListings).orderBy(desc(cleanedListings.runId)).limit(1);

            return NextResponse.json({ run_id: rows[0]?.runId ?? null });
        }

        // Check count of zpid in a given run
        if (zpid && runId && countOnly === "1") {
            const rows = await db
                .select({ id: cleanedListings.id })
                .from(cleanedListings)
                .where(and(eq(cleanedListings.zpid, zpid), eq(cleanedListings.runId, runId)));

            return NextResponse.json({ count: rows.length });
        }

        // Get latest scraped_at for a zpid
        if (zpid && latestScrapedAt === "1") {
            const rows = await db
                .select({ scrapedAt: cleanedListings.scrapedAt })
                .from(cleanedListings)
                .where(eq(cleanedListings.zpid, zpid))
                .orderBy(desc(cleanedListings.scrapedAt))
                .limit(1);

            return NextResponse.json({ scraped_at: rows[0]?.scrapedAt ?? null });
        }

        // Single listing by ID
        if (id) {
            const rows = await db
                .select({
                    id: cleanedListings.id,
                    zpid: cleanedListings.zpid,
                    rawScrapeId: cleanedListings.rawScrapeId,
                    imgSrc: cleanedListings.imgSrc,
                    detailUrl: cleanedListings.detailUrl,
                    addressRaw: cleanedListings.addressRaw,
                    addressStreet: cleanedListings.addressStreet,
                    addressCity: cleanedListings.addressCity,
                    addressState: cleanedListings.addressState,
                    addressZip: cleanedListings.addressZip,
                    price: cleanedListings.price,
                    beds: cleanedListings.beds,
                    baths: cleanedListings.baths,
                    area: cleanedListings.area,
                    availabilityDate: cleanedListings.availabilityDate,
                    scrapedAt: cleanedListings.scrapedAt,
                    latitude: cleanedListings.latitude,
                    longitude: cleanedListings.longitude,
                    isBuilding: cleanedListings.isBuilding,
                    buildingZpid: cleanedListings.buildingZpid,
                    homeType: cleanedListings.homeType,
                    laundry: cleanedListings.laundry,
                })
                .from(cleanedListings)
                .where(eq(cleanedListings.id, id))
                .limit(1);

            if (rows.length === 0) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }

            const r = rows[0];
            return NextResponse.json({
                id: r.id,
                zpid: r.zpid,
                raw_scrape_id: r.rawScrapeId,
                img_src: r.imgSrc,
                detail_url: r.detailUrl,
                address_raw: r.addressRaw,
                address_street: r.addressStreet,
                address_city: r.addressCity,
                address_state: r.addressState,
                address_zip: r.addressZip,
                price: r.price,
                beds: r.beds,
                baths: r.baths,
                area: r.area,
                availability_date: r.availabilityDate,
                scraped_at: r.scrapedAt,
                latitude: r.latitude,
                longitude: r.longitude,
                is_building: r.isBuilding,
                building_zpid: r.buildingZpid,
                home_type: r.homeType,
                laundry: r.laundry,
            });
        }

        // Units for a building
        if (buildingZpid) {
            const rows = await db
                .select({
                    id: cleanedListings.id,
                    zpid: cleanedListings.zpid,
                    price: cleanedListings.price,
                    beds: cleanedListings.beds,
                    baths: cleanedListings.baths,
                    area: cleanedListings.area,
                })
                .from(cleanedListings)
                .where(eq(cleanedListings.buildingZpid, buildingZpid))
                .orderBy(cleanedListings.beds, cleanedListings.baths, cleanedListings.price);

            return NextResponse.json(
                rows.map((r) => ({
                    id: r.id,
                    zpid: r.zpid,
                    price: r.price,
                    beds: r.beds,
                    baths: r.baths,
                    area: r.area,
                })),
            );
        }

        // Bulk lookup by IDs (for comps page)
        if (idsParam) {
            const ids = idsParam.split(",").filter(Boolean);
            if (ids.length === 0) {
                return NextResponse.json([]);
            }

            const rows = await db
                .select({
                    id: cleanedListings.id,
                    imgSrc: cleanedListings.imgSrc,
                    latitude: cleanedListings.latitude,
                    longitude: cleanedListings.longitude,
                })
                .from(cleanedListings)
                .where(inArray(cleanedListings.id, ids));

            return NextResponse.json(
                rows.map((r) => ({
                    id: r.id,
                    img_src: r.imgSrc,
                    latitude: r.latitude,
                    longitude: r.longitude,
                })),
            );
        }

        return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    } catch (error: any) {
        console.error("Error in GET /api/listings/cleaned:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
