import { createClient } from "@/utils/supabase/server";

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

  const supabase = await createClient();

  // Look up all counties in a single query
  const { data: counties, error } = await supabase
    .from("counties")
    .select("id, name")
    .in("name", countyNames);

  if (error) {
    console.error("Error fetching counties:", error);
    throw error;
  }

  // Create a map of county name to ID
  const countyMap = new Map<string, string>();
  for (const county of counties || []) {
    countyMap.set(county.name, county.id);
  }

  // Get the 'Other' county ID as fallback
  const { data: otherCounty, error: otherError } = await supabase
    .from("counties")
    .select("id")
    .eq("name", "Other")
    .single();

  if (otherError || !otherCounty) {
    throw new Error("'Other' county not found in database");
  }

  const otherCountyId = otherCounty.id;

  // Map county names to IDs, using 'Other' as fallback for missing counties
  const countyIds: string[] = [];
  for (const countyName of countyNames) {
    const countyId = countyMap.get(countyName) || otherCountyId;
    countyIds.push(countyId);
  }

  return countyIds;
}
