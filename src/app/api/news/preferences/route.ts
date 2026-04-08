import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cities, counties, profiles, subscriberCities, subscriberCounties, subscribers } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const profileRows = await db
            .select({
                newsletterActive: profiles.newsletterActive,
                newsletterInterests: profiles.newsletterInterests,
                newsletterTimezone: profiles.newsletterTimezone,
                newsletterPreferredSendTimes: profiles.newsletterPreferredSendTimes,
                newsletterSubscribedAt: profiles.newsletterSubscribedAt,
                subscriberId: profiles.subscriberId,
            })
            .from(profiles)
            .where(eq(profiles.id, user.id));

        if (profileRows.length === 0) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        const profile = profileRows[0];

        let countyNames: string[] = [];
        let cityList: any[] = [];

        if (profile.subscriberId) {
            const countyRows = await db
                .select({ countyName: counties.name })
                .from(subscriberCounties)
                .innerJoin(counties, eq(subscriberCounties.countyId, counties.id))
                .where(eq(subscriberCounties.subscriberId, profile.subscriberId));

            countyNames = countyRows.map((r) => r.countyName);

            const cityRows = await db
                .select({ cityName: cities.name, cityState: cities.state, cityStateAbbr: cities.stateAbbr })
                .from(subscriberCities)
                .innerJoin(cities, eq(subscriberCities.cityId, cities.id))
                .where(eq(subscriberCities.subscriberId, profile.subscriberId));

            cityList = cityRows.map((r) => ({
                name: r.cityName,
                state: r.cityState,
                stateAbbr: r.cityStateAbbr,
            }));
        }

        return NextResponse.json({
            newsletter_active: profile.newsletterActive,
            newsletter_interests: profile.newsletterInterests,
            newsletter_timezone: profile.newsletterTimezone,
            newsletter_preferred_send_times: profile.newsletterPreferredSendTimes,
            newsletter_subscribed_at: profile.newsletterSubscribedAt,
            subscriber_id: profile.subscriberId,
            counties: countyNames,
            cities: cityList,
        });
    } catch (error: any) {
        console.error("Error in GET /api/news/preferences:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { newsletter_active, newsletter_interests, newsletter_timezone, newsletter_preferred_send_times, selected_counties, selected_cities } = body;

        const currentProfileRows = await db
            .select({ subscriberId: profiles.subscriberId, fullName: profiles.fullName })
            .from(profiles)
            .where(eq(profiles.id, user.id));

        const currentProfile = currentProfileRows[0];
        let subscriberId = currentProfile?.subscriberId;

        if (newsletter_active && !subscriberId) {
            const existingSubscriberRows = await db.select({ id: subscribers.id }).from(subscribers).where(eq(subscribers.email, user.email!));

            if (existingSubscriberRows.length > 0) {
                subscriberId = existingSubscriberRows[0].id;
            } else {
                const newSubscriberRows = await db
                    .insert(subscribers)
                    .values({
                        email: user.email!,
                        fullName: currentProfile?.fullName || user.email!.split("@")[0],
                        isActive: true,
                        interests: newsletter_interests,
                        timezone: newsletter_timezone,
                        preferredSendTimes: newsletter_preferred_send_times,
                    })
                    .returning({ id: subscribers.id });

                if (newSubscriberRows.length === 0) {
                    return NextResponse.json({ error: "Failed to create subscriber" }, { status: 500 });
                }
                subscriberId = newSubscriberRows[0].id;
            }
        }

        const updateData: Partial<typeof profiles.$inferInsert> = {
            subscriberId,
        };

        if (typeof newsletter_active === "boolean") {
            updateData.newsletterActive = newsletter_active;
            if (newsletter_active && !body.newsletter_subscribed_at) {
                updateData.newsletterSubscribedAt = new Date().toISOString();
            }
        }
        if (newsletter_interests !== undefined) {
            updateData.newsletterInterests = newsletter_interests;
        }
        if (newsletter_timezone !== undefined) {
            updateData.newsletterTimezone = newsletter_timezone;
        }
        if (newsletter_preferred_send_times !== undefined) {
            updateData.newsletterPreferredSendTimes = newsletter_preferred_send_times;
        }

        const updateResult = await db.update(profiles).set(updateData).where(eq(profiles.id, user.id));

        if (subscriberId) {
            await db
                .update(subscribers)
                .set({
                    isActive: newsletter_active,
                    interests: newsletter_interests,
                    timezone: newsletter_timezone,
                    preferredSendTimes: newsletter_preferred_send_times,
                })
                .where(eq(subscribers.id, subscriberId));

            if (selected_counties !== undefined) {
                await db.delete(subscriberCounties).where(eq(subscriberCounties.subscriberId, subscriberId));

                if (selected_counties.length > 0) {
                    const countyRows = await db
                        .select({ id: counties.id, name: counties.name })
                        .from(counties)
                        .where(inArray(counties.name, selected_counties));

                    if (countyRows.length > 0) {
                        await db.insert(subscriberCounties).values(
                            countyRows.map((county) => ({
                                subscriberId,
                                countyId: county.id,
                            })),
                        );
                    }
                }
            }

            if (selected_cities !== undefined) {
                await db.delete(subscriberCities).where(eq(subscriberCities.subscriberId, subscriberId));

                if (selected_cities.length > 0) {
                    for (const city of selected_cities) {
                        const existingCityRows = await db
                            .select({ id: cities.id })
                            .from(cities)
                            .where(and(eq(cities.name, city.name), eq(cities.stateAbbr, city.stateAbbr)));

                        let cityId: string;

                        if (existingCityRows.length > 0) {
                            cityId = existingCityRows[0].id;
                        } else {
                            const newCityRows = await db
                                .insert(cities)
                                .values({
                                    name: city.name,
                                    state: city.state,
                                    stateAbbr: city.stateAbbr,
                                })
                                .returning({ id: cities.id });

                            if (newCityRows.length === 0) continue;
                            cityId = newCityRows[0].id;
                        }

                        await db.insert(subscriberCities).values({
                            subscriberId,
                            cityId,
                        });
                    }
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in PUT /api/news/preferences:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
