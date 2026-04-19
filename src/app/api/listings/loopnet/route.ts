import { and, desc, eq, gte, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import { SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loopnetListings } from "@/db/schema";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const id = searchParams.get("id");

        if (id) {
            const rows = await db
                .select({
                    id: loopnetListings.id,
                    address: loopnetListings.address,
                    headline: loopnetListings.headline,
                    location: loopnetListings.location,
                    price: loopnetListings.price,
                    capRate: loopnetListings.capRate,
                    buildingCategory: loopnetListings.buildingCategory,
                    squareFootage: loopnetListings.squareFootage,
                    thumbnailUrl: loopnetListings.thumbnailUrl,
                    listingUrl: loopnetListings.listingUrl,
                    omUrl: loopnetListings.omUrl,
                    createdAt: loopnetListings.createdAt,
                    runId: loopnetListings.runId,
                    unitMix: loopnetListings.unitMix,
                    attachmentUrls: loopnetListings.attachmentUrls,
                })
                .from(loopnetListings)
                .where(eq(loopnetListings.id, id))
                .limit(1);

            if (rows.length === 0) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }

            const r = rows[0];
            const attachmentUrlsRaw = r.attachmentUrls;
            const attachment_urls =
                Array.isArray(attachmentUrlsRaw) && attachmentUrlsRaw.length > 0
                    ? attachmentUrlsRaw
                          .map((item) => {
                              if (!item || typeof item !== "object") return null;
                              const o = item as Record<string, unknown>;
                              const url = typeof o.url === "string" ? o.url.trim() : "";
                              const source_url = typeof o.source_url === "string" ? o.source_url.trim() : "";
                              if (!url || !source_url) return null;
                              const description = typeof o.description === "string" ? o.description : null;
                              return { source_url, url, ...(description ? { description } : {}) };
                          })
                          .filter(Boolean)
                    : null;

            return NextResponse.json({
                id: r.id,
                address: r.address,
                headline: r.headline,
                location: r.location,
                price: r.price,
                cap_rate: r.capRate,
                building_category: r.buildingCategory,
                square_footage: r.squareFootage,
                thumbnail_url: r.thumbnailUrl,
                listing_url: r.listingUrl,
                om_url: r.omUrl,
                created_at: r.createdAt,
                run_id: r.runId,
                unit_mix: Array.isArray(r.unitMix) && r.unitMix.length > 0 ? r.unitMix : null,
                attachment_urls: attachment_urls && attachment_urls.length > 0 ? attachment_urls : null,
            });
        }

        // Check for latest_run_id only mode
        const latestRunOnly = searchParams.get("latest_run_id");
        if (latestRunOnly === "1") {
            const rows = await db.select({ runId: loopnetListings.runId }).from(loopnetListings).orderBy(desc(loopnetListings.runId)).limit(1);

            return NextResponse.json({ run_id: rows[0]?.runId ?? null });
        }

        // Full filtered query for map
        const latestOnly = searchParams.get("latest_only") === "1";
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
        const hasOm = searchParams.get("has_om") === "1";

        const conditions: SQL[] = [isNotNull(loopnetListings.latitude), isNotNull(loopnetListings.longitude)];

        if (hasOm) {
            conditions.push(
                or(
                    and(isNotNull(loopnetListings.omUrl), sql`trim(both from ${loopnetListings.omUrl}) <> ''`)!,
                    and(
                        isNotNull(loopnetListings.attachmentUrls),
                        sql`jsonb_typeof(${loopnetListings.attachmentUrls}) = 'array'`,
                        sql`jsonb_array_length(${loopnetListings.attachmentUrls}) > 0`,
                    )!,
                )!,
            );
        }

        if (latestOnly) {
            const latestRows = await db.select({ runId: loopnetListings.runId }).from(loopnetListings).orderBy(desc(loopnetListings.runId)).limit(1);
            const latestRunId = latestRows[0]?.runId;
            if (latestRunId != null) {
                conditions.push(eq(loopnetListings.runId, latestRunId));
            }
        }

        if (zipCode) {
            conditions.push(or(ilike(loopnetListings.address, `%${zipCode}%`), ilike(loopnetListings.location, `%${zipCode}%`))!);
        } else if (cityName) {
            conditions.push(ilike(loopnetListings.location, `%${cityName}%`));
        } else if (countyName) {
            conditions.push(or(ilike(loopnetListings.address, `%${countyName}%`), ilike(loopnetListings.location, `%${countyName}%`))!);
        } else if (addressQuery) {
            conditions.push(
                or(
                    ilike(loopnetListings.headline, `%${addressQuery}%`),
                    ilike(loopnetListings.address, `%${addressQuery}%`),
                    ilike(loopnetListings.location, `%${addressQuery}%`),
                )!,
            );
        }

        if (priceMin) {
            const v = parseFloat(priceMin);
            if (!isNaN(v)) conditions.push(gte(loopnetListings.price, String(v)));
        }
        if (priceMax) {
            const v = parseFloat(priceMax);
            if (!isNaN(v)) conditions.push(lte(loopnetListings.price, String(v)));
        }
        if (capRateMin) {
            const v = parseFloat(capRateMin);
            if (!isNaN(v)) conditions.push(gte(loopnetListings.capRate, String(v)));
        }
        if (capRateMax) {
            const v = parseFloat(capRateMax);
            if (!isNaN(v)) conditions.push(lte(loopnetListings.capRate, String(v)));
        }
        if (sqftMin) {
            const v = parseFloat(sqftMin);
            if (!isNaN(v)) conditions.push(gte(loopnetListings.squareFootage, String(v)));
        }
        if (sqftMax) {
            const v = parseFloat(sqftMax);
            if (!isNaN(v)) conditions.push(lte(loopnetListings.squareFootage, String(v)));
        }

        if (boundsWest && boundsEast && boundsSouth && boundsNorth) {
            const west = parseFloat(boundsWest);
            const east = parseFloat(boundsEast);
            const south = parseFloat(boundsSouth);
            const north = parseFloat(boundsNorth);
            if (!isNaN(west) && !isNaN(east) && !isNaN(south) && !isNaN(north)) {
                conditions.push(
                    and(
                        gte(loopnetListings.latitude, south),
                        lte(loopnetListings.latitude, north),
                        gte(loopnetListings.longitude, west),
                        lte(loopnetListings.longitude, east),
                    )!,
                );
            }
        }

        const rows = await db
            .select()
            .from(loopnetListings)
            .where(and(...conditions))
            .orderBy(desc(loopnetListings.createdAt));

        const result = rows.map((r) => {
            const attachmentUrlsRaw = r.attachmentUrls;
            const attachment_urls =
                Array.isArray(attachmentUrlsRaw) && attachmentUrlsRaw.length > 0
                    ? attachmentUrlsRaw
                          .map((item) => {
                              if (!item || typeof item !== "object") return null;
                              const o = item as Record<string, unknown>;
                              const url = typeof o.url === "string" ? o.url.trim() : "";
                              const source_url = typeof o.source_url === "string" ? o.source_url.trim() : "";
                              if (!url || !source_url) return null;
                              const description = typeof o.description === "string" ? o.description : null;
                              return { source_url, url, ...(description ? { description } : {}) };
                          })
                          .filter(Boolean)
                    : null;

            return {
                id: r.id,
                address: r.address,
                headline: r.headline,
                location: r.location,
                price: r.price,
                cap_rate: r.capRate,
                building_category: r.buildingCategory,
                square_footage: r.squareFootage,
                thumbnail_url: r.thumbnailUrl,
                listing_url: r.listingUrl,
                created_at: r.createdAt,
                run_id: r.runId,
                latitude: r.latitude,
                longitude: r.longitude,
                attachment_urls: attachment_urls && attachment_urls.length > 0 ? attachment_urls : null,
            };
        });

        return NextResponse.json({ data: result, count: result.length });
    } catch (error: any) {
        console.error("Error in GET /api/listings/loopnet:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
