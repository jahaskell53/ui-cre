import { ApifyClient } from "apify-client";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { articleCities, articleCounties, articleTags, articles, sources } from "@/db/schema";
import { generateArticleTitles, getArticleTags, getCityCategories, getCountyCategories } from "@/lib/news/categorization";
import { getCountyIds } from "@/lib/news/counties";
import { getLinkedInProfiles } from "@/lib/news/news-sources";

export const dynamic = "force-dynamic";

// Helper function to parse LinkedIn timeSincePosted into actual date
function parseLinkedInDate(timeSincePosted?: string, publishedAt?: string): string {
    if (timeSincePosted) {
        const now = new Date();
        const timeStr = timeSincePosted.toLowerCase();

        if (timeStr.includes("h")) {
            const hours = parseInt(timeStr.replace("h", ""));
            return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
        } else if (timeStr.includes("d")) {
            const days = parseInt(timeStr.replace("d", ""));
            return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        } else if (timeStr.includes("w")) {
            const weeks = parseInt(timeStr.replace("w", ""));
            return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (timeStr.includes("m")) {
            const months = parseInt(timeStr.replace("m", ""));
            return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
        } else {
            // Fallback to 1 day ago if format is unrecognized
            return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        }
    } else if (publishedAt) {
        return new Date(publishedAt).toISOString();
    } else {
        // Fallback to 1 day ago
        return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    }
}

interface LinkedInPost {
    title?: string;
    text?: string;
    url?: string;
    publishedAt?: string;
    timeSincePosted?: string;
    author?:
        | {
              firstName?: string;
              lastName?: string;
              occupation?: string;
              id?: string;
              publicId?: string;
              trackingId?: string;
              profileId?: string;
              picture?: string;
              backgroundImage?: string;
          }
        | string;
    imageUrl?: string;
}

interface ArticleItem {
    title: string;
    link: string;
    description: string;
    date: string;
    source: string;
    imageUrl?: string;
    counties?: string[];
    cities?: string[];
    tags?: string[];
}

export async function GET(request: NextRequest) {
    try {
        console.log("🔗 Starting LinkedIn scraping via Apify...");

        // Check for authorization header
        const authHeader = request.headers.get("authorization");
        const expectedToken = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

        if (!expectedToken) {
            console.error("ADMIN_SECRET or CRON_SECRET not configured");
            return NextResponse.json({ error: "Admin access not configured" }, { status: 500 });
        }

        if (authHeader !== `Bearer ${expectedToken}`) {
            console.error("Unauthorized attempt to scrape LinkedIn");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("✅ Authentication successful");

        const apiToken = process.env.APIFY_TOKEN;
        if (!apiToken) {
            console.error("APIFY_TOKEN not configured");
            return NextResponse.json({ error: "Apify token not configured" }, { status: 500 });
        }

        // Initialize the ApifyClient
        const client = new ApifyClient({
            token: apiToken,
        });

        // Read cookie from environment variable
        let cookieArray;
        try {
            const cookieJson = process.env.LINKEDIN_COOKIES;
            if (!cookieJson) {
                console.error("LINKEDIN_COOKIES not configured");
                return NextResponse.json({ error: "LinkedIn cookies not configured" }, { status: 500 });
            }
            cookieArray = JSON.parse(cookieJson);
            console.log(`🍪 Loaded cookie data with ${cookieArray?.length || 0} cookies`);
        } catch (error) {
            console.error("Failed to parse LINKEDIN_COOKIES:", error);
            return NextResponse.json({ error: "Failed to parse cookie data" }, { status: 500 });
        }

        // Fetch LinkedIn profiles from database
        const linkedinProfiles = await getLinkedInProfiles();

        if (linkedinProfiles.length === 0) {
            console.warn("⚠️ No LinkedIn profiles found in database");
            return NextResponse.json(
                {
                    error: "No LinkedIn profiles configured",
                    profilesScraped: 0,
                    articlesFound: 0,
                    articlesSaved: 0,
                },
                { status: 500 },
            );
        }

        // Prepare Actor input
        const input = {
            urls: linkedinProfiles.map((profile) => profile.url).filter((url): url is string => url !== null),
            deepScrape: true,
            rawData: false,
            minDelay: 2,
            maxDelay: 8,
            limitPerSource: 10,
            cookie: cookieArray || [],
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            proxy: {
                useApifyProxy: true,
                apifyProxyCountry: "US",
            },
        };

        console.log(`📊 Scraping ${linkedinProfiles.length} LinkedIn profiles`);
        console.log(`🔑 Using APIFY_TOKEN: ${apiToken.substring(0, 8)}...`);

        // Run the Actor and wait for it to finish
        console.log(`🚀 Starting Apify actor call...`);
        const run = await client.actor("kfiWbq3boy3dWKbiL").call(input);
        console.log(`⏱️ Apify actor completed with run ID: ${run.id}`);

        // Fetch results from the run's dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        console.log(`📝 Retrieved ${items.length} items from Apify`);

        // Transform Apify results into article format (without categorization first)
        const rawArticles = items
            .filter((item: LinkedInPost) => item && (item.title || item.text) && item.url)
            .map((item: LinkedInPost) => {
                const title = item.title || item.text?.substring(0, 100) + "..." || "LinkedIn Post";
                const description = item.text || item.title || "";
                const date = parseLinkedInDate(item.timeSincePosted, item.publishedAt);
                const source =
                    typeof item.author === "string"
                        ? item.author
                        : item.author?.firstName && item.author?.lastName
                          ? `${item.author.firstName} ${item.author.lastName}`
                          : "LinkedIn";

                return {
                    title: title.substring(0, 200),
                    link: item.url || "",
                    description: description.substring(0, 500),
                    date,
                    source,
                    imageUrl: item.imageUrl,
                };
            });

        console.log(`✅ Processed ${rawArticles.length} LinkedIn posts into raw articles`);

        // Apply Gemini processing (titles + categorization)
        const aiStartTime = Date.now();
        const articleData = rawArticles.map((a) => ({ title: a.title || "", description: a.description }));
        console.log(`🤖 Starting AI processing for ${articleData.length} LinkedIn articles`);

        const generatedContent = await generateArticleTitles(articleData);
        const countyCategories = await getCountyCategories(articleData);
        const cityCategories = await getCityCategories(articleData);
        const articleTags2 = await getArticleTags(articleData);

        const aiTime = Date.now() - aiStartTime;
        console.log(`⏱️ AI processing completed in ${aiTime}ms`);

        // Map to final article format with Gemini-generated titles, descriptions, and tags
        const articleItems: ArticleItem[] = rawArticles.map((article, index) => ({
            ...article,
            title: generatedContent.titles[index] || article.title,
            description: generatedContent.descriptions[index] || article.description,
            counties: countyCategories[index] || ["Other"],
            cities: cityCategories[index] || [],
            tags: [...(articleTags2[index] || []), "linkedin", "social-media"],
        }));

        console.log(`✅ Processed ${articleItems.length} LinkedIn posts into articles`);

        // Ensure LinkedIn source exists
        await db
            .insert(sources)
            .values({
                sourceId: "linkedin",
                sourceName: "LinkedIn",
            })
            .onConflictDoNothing();

        let saved = 0;
        for (const article of articleItems) {
            try {
                const articleSourceId = article.source || "linkedin";

                // Ensure article's source exists
                if (articleSourceId !== "linkedin") {
                    await db
                        .insert(sources)
                        .values({
                            sourceId: articleSourceId,
                            sourceName: articleSourceId,
                        })
                        .onConflictDoNothing();
                }

                // Check if article already exists
                const [existingArticle] = await db.select({ id: articles.id }).from(articles).where(eq(articles.link, article.link));

                if (existingArticle) {
                    continue;
                }

                const [createdArticle] = await db
                    .insert(articles)
                    .values({
                        link: article.link,
                        title: article.title,
                        sourceId: articleSourceId,
                        date: new Date(article.date).toISOString(),
                        imageUrl: article.imageUrl || null,
                        description: article.description || null,
                        isCategorized: true,
                    })
                    .returning({ id: articles.id })
                    .onConflictDoNothing();

                if (!createdArticle) continue;

                // Insert counties
                if (article.counties && article.counties.length > 0) {
                    const countyIds = await getCountyIds(article.counties);
                    if (countyIds.length > 0) {
                        await db
                            .insert(articleCounties)
                            .values(
                                countyIds.map((countyId) => ({
                                    articleId: createdArticle.id,
                                    countyId: countyId,
                                })),
                            )
                            .onConflictDoNothing();
                    }
                }

                // Insert cities
                if (article.cities && article.cities.length > 0) {
                    await db
                        .insert(articleCities)
                        .values(
                            article.cities.map((city) => ({
                                articleId: createdArticle.id,
                                city: city,
                            })),
                        )
                        .onConflictDoNothing();
                }

                // Insert tags
                if (article.tags && article.tags.length > 0) {
                    await db
                        .insert(articleTags)
                        .values(
                            article.tags.map((tag) => ({
                                articleId: createdArticle.id,
                                tag: tag,
                            })),
                        )
                        .onConflictDoNothing();
                }

                saved++;
            } catch (error) {
                console.error(`Error saving article ${article.link}:`, error);
            }
        }

        console.log(`💾 Saved ${saved} LinkedIn articles to database`);

        const result = {
            message: "LinkedIn scraping completed successfully",
            profilesScraped: linkedinProfiles.length,
            postsFound: items.length,
            articlesProcessed: articleItems.length,
            articlesSaved: saved,
            runId: run.id,
        };

        console.log("LinkedIn scraping completed:", result);

        return NextResponse.json(result);
    } catch (error) {
        console.error("LinkedIn scraping error:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}
