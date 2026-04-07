import { eq } from "drizzle-orm";
import { db } from "@/db";
import { people } from "@/db/schema";

// Calculate interaction count from timeline (emails + meetings)
function getInteractionCount(timeline: any[] = []): number {
    if (!timeline || !Array.isArray(timeline)) return 0;
    const emails = timeline.filter((item) => item.type === "email");
    const meetings = timeline.filter((item) => item.type === "meeting");
    return emails.length + meetings.length;
}

// Calculate network strength for all people and update database
export async function recalculateNetworkStrengthForUser(userId: string): Promise<void> {
    try {
        const allPeople = await db.select({ id: people.id, timeline: people.timeline }).from(people).where(eq(people.userId, userId));

        if (!allPeople || allPeople.length === 0) {
            return;
        }

        // Calculate interaction count for each person
        const peopleWithCounts = allPeople.map((p) => ({
            id: p.id,
            count: getInteractionCount(p.timeline as any[]),
        }));

        // Sort by interaction count (descending)
        peopleWithCounts.sort((a, b) => b.count - a.count);

        const totalPeople = peopleWithCounts.length;

        // Calculate network strength for each person and batch update
        await Promise.all(
            peopleWithCounts.map(async (person, index) => {
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

                await db.update(people).set({ networkStrength: strength }).where(eq(people.id, person.id));
            }),
        );

        console.log(`Recalculated network strength for ${peopleWithCounts.length} people`);
    } catch (error) {
        console.error("Error recalculating network strength:", error);
    }
}
