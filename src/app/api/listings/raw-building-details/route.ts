import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rawBuildingDetails } from "@/db/schema";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const buildingZpid = searchParams.get("building_zpid");

        if (!buildingZpid) {
            return NextResponse.json({ error: "building_zpid is required" }, { status: 400 });
        }

        const rows = await db
            .select({ rawJson: rawBuildingDetails.rawJson })
            .from(rawBuildingDetails)
            .where(eq(rawBuildingDetails.buildingZpid, buildingZpid))
            .orderBy(desc(rawBuildingDetails.scrapedAt))
            .limit(1);

        if (rows.length === 0) {
            return NextResponse.json([]);
        }

        return NextResponse.json([{ raw_json: rows[0].rawJson }]);
    } catch (error: any) {
        console.error("Error in GET /api/listings/raw-building-details:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
