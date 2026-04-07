import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawZillowScrapes } from "@/db/schema";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const id = searchParams.get("id");
        const zipCode = searchParams.get("zip_code");

        if (id) {
            const rows = await db.select({ rawJson: rawZillowScrapes.rawJson }).from(rawZillowScrapes).where(eq(rawZillowScrapes.id, id)).limit(1);

            if (rows.length === 0) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }

            return NextResponse.json({ raw_json: rows[0].rawJson });
        }

        if (zipCode) {
            const rows = await db
                .select({ rawJson: rawZillowScrapes.rawJson })
                .from(rawZillowScrapes)
                .where(eq(rawZillowScrapes.zipCode, zipCode))
                .orderBy(desc(rawZillowScrapes.scrapedAt))
                .limit(1);

            if (rows.length === 0) {
                return NextResponse.json([]);
            }

            return NextResponse.json([{ raw_json: rows[0].rawJson }]);
        }

        return NextResponse.json({ error: "id or zip_code is required" }, { status: 400 });
    } catch (error: any) {
        console.error("Error in GET /api/listings/raw-zillow-scrapes:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
