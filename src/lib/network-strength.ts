import { SupabaseClient } from "@supabase/supabase-js";

// Calculate interaction count from timeline (emails + meetings)
function getInteractionCount(timeline: any[] = []): number {
  if (!timeline || !Array.isArray(timeline)) return 0;
  const emails = timeline.filter(item => item.type === 'email');
  const meetings = timeline.filter(item => item.type === 'meeting');
  return emails.length + meetings.length;
}

// Calculate network strength for all people and update database
export async function recalculateNetworkStrengthForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    // Fetch all people for the user (only need id and timeline)
    const { data: allPeople, error: peopleError } = await supabase
      .from("people")
      .select("id, timeline")
      .eq("user_id", userId);

    if (peopleError) {
      console.error("Error fetching people for network strength calculation:", peopleError);
      return;
    }

    if (!allPeople || allPeople.length === 0) {
      return;
    }

    // Calculate interaction count for each person
    const peopleWithCounts = allPeople.map(p => ({
      id: p.id,
      count: getInteractionCount(p.timeline),
    }));

    // Sort by interaction count (descending)
    peopleWithCounts.sort((a, b) => b.count - a.count);

    const totalPeople = peopleWithCounts.length;

    // Calculate network strength for each person and prepare updates
    const updates = peopleWithCounts.map((person, index) => {
      const percentile = (totalPeople - index) / totalPeople;
      let strength: "HIGH" | "MEDIUM" | "LOW";

      if (person.count === 0) {
        strength = "LOW";
      } else if (percentile > 0.8) {
        strength = "HIGH";
      } else if (percentile <= 0.2) {
        strength = "LOW";
      } else {
        strength = "MEDIUM";
      }

      return {
        id: person.id,
        network_strength: strength,
      };
    });

    // Batch update all people's network strength
    await Promise.all(
      updates.map(update =>
        supabase
          .from("people")
          .update({ network_strength: update.network_strength })
          .eq("id", update.id)
      )
    );

    console.log(`Recalculated network strength for ${updates.length} people`);
  } catch (error) {
    console.error("Error recalculating network strength:", error);
  }
}
