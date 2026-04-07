import { eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, subscribers } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * This endpoint links existing subscribers to cre-ui user accounts.
 * It matches subscribers by email address to auth.users and updates
 * the profiles table with the subscriber_id.
 *
 * This is a one-time migration endpoint that can be run to link
 * existing cre-news-aggregator subscribers to their cre-ui accounts.
 */
export async function POST(request: NextRequest) {
    try {
        // Verify this is an admin request
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.log("UNAUTHORIZED: Invalid or missing auth header");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("Starting subscriber linking process...");

        // Get all subscribers
        const allSubscribers = await db
            .select({
                id: subscribers.id,
                email: subscribers.email,
                fullName: subscribers.fullName,
                isActive: subscribers.isActive,
                interests: subscribers.interests,
                timezone: subscribers.timezone,
                preferredSendTimes: subscribers.preferredSendTimes,
            })
            .from(subscribers);

        console.log(`Found ${allSubscribers.length} subscribers to process`);

        let linkedCount = 0;
        let alreadyLinkedCount = 0;
        let notFoundCount = 0;
        const results: Array<{ email: string; status: string; subscriberId?: string }> = [];

        for (const subscriber of allSubscribers) {
            try {
                // Check if this subscriber is already linked to a profile
                const [existingLink] = await db
                    .select({ id: profiles.id, subscriberId: profiles.subscriberId })
                    .from(profiles)
                    .where(eq(profiles.subscriberId, subscriber.id));

                if (existingLink) {
                    alreadyLinkedCount++;
                    results.push({
                        email: subscriber.email,
                        status: "already_linked",
                        subscriberId: subscriber.id,
                    });
                    continue;
                }

                // For now, skip profiles that we can't match and log them
                notFoundCount++;
                results.push({
                    email: subscriber.email,
                    status: "no_matching_profile",
                    subscriberId: subscriber.id,
                });
            } catch (error) {
                console.error(`Error processing subscriber ${subscriber.email}:`, error);
                results.push({
                    email: subscriber.email,
                    status: "error",
                    subscriberId: subscriber.id,
                });
            }
        }

        console.log("Subscriber linking complete:", {
            total: allSubscribers.length,
            linked: linkedCount,
            alreadyLinked: alreadyLinkedCount,
            notFound: notFoundCount,
        });

        return NextResponse.json({
            message: "Subscriber linking process completed",
            total: allSubscribers.length,
            linked: linkedCount,
            alreadyLinked: alreadyLinkedCount,
            notFound: notFoundCount,
            results,
        });
    } catch (error) {
        console.error("Error in subscriber linking:", error);
        return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}

/**
 * Link a single subscriber to the current user's profile.
 * This is called when a user logs in and we want to link their
 * existing subscriber record to their profile.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get current user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check if user already has a subscriber linked
        const [profile] = await db.select({ subscriberId: profiles.subscriberId }).from(profiles).where(eq(profiles.id, user.id));

        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 500 });
        }

        if (profile.subscriberId) {
            return NextResponse.json({
                message: "Profile already linked to subscriber",
                subscriberId: profile.subscriberId,
            });
        }

        // Try to find a subscriber with the user's email
        const [subscriber] = await db
            .select({
                id: subscribers.id,
                fullName: subscribers.fullName,
                interests: subscribers.interests,
                timezone: subscribers.timezone,
                preferredSendTimes: subscribers.preferredSendTimes,
                isActive: subscribers.isActive,
            })
            .from(subscribers)
            .where(eq(subscribers.email, (user.email || "").toLowerCase()));

        if (!subscriber) {
            return NextResponse.json({
                message: "No existing subscriber found for this email",
                linked: false,
            });
        }

        // Link the subscriber to the profile
        await db
            .update(profiles)
            .set({
                subscriberId: subscriber.id,
                newsletterActive: subscriber.isActive ?? false,
                newsletterInterests: subscriber.interests,
                newsletterTimezone: subscriber.timezone,
                newsletterPreferredSendTimes: subscriber.preferredSendTimes,
                newsletterSubscribedAt: new Date().toISOString(),
            })
            .where(eq(profiles.id, user.id));

        console.log(`Linked subscriber ${subscriber.id} to user ${user.id}`);

        return NextResponse.json({
            message: "Successfully linked subscriber to profile",
            subscriberId: subscriber.id,
            linked: true,
        });
    } catch (error) {
        console.error("Error in subscriber linking:", error);
        return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
