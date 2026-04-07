import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { counties } from "@/db/schema";

/**
 * Get county IDs for an array of county names.
 * If a county name doesn't exist in the database, it will use 'Other' as fallback.
 * @param countyNames - Array of county names
 * @returns Array of county IDs (UUIDs)
 */
export async function getCountyIds(countyNames: string[]): Promise<string[]> {
    if (countyNames.length === 0) {
        return [];
    }

    const countyRows = await db.select({ id: counties.id, name: counties.name }).from(counties).where(inArray(counties.name, countyNames));

    const countyMap = new Map<string, string>();
    for (const county of countyRows) {
        countyMap.set(county.name, county.id);
    }

    const otherCountyRows = await db.select({ id: counties.id }).from(counties).where(eq(counties.name, "Other"));

    if (otherCountyRows.length === 0) {
        throw new Error("'Other' county not found in database");
    }

    const otherCountyId = otherCountyRows[0].id;

    const countyIds: string[] = [];
    for (const countyName of countyNames) {
        const countyId = countyMap.get(countyName) || otherCountyId;
        countyIds.push(countyId);
    }

    return countyIds;
}
