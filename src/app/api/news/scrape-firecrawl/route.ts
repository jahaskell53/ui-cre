import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import pRetry from "p-retry";
import { db } from "@/db";
import { articleCities, articleCounties, articleTags, articles, sources } from "@/db/schema";
import { getCountyIds } from "@/lib/news/counties";
import { getFirecrawlSources, sanitizeImageUrl } from "@/lib/news/news-sources";

export const dynamic = "force-dynamic";

// Helper function to safely convert date strings to ISO format
function safeDateToISO(dateString?: string): string {
    try {
        return new Date(dateString || "").toISOString();
    } catch {
        return new Date().toISOString();
    }
}

interface ScrapedArticleRaw {
    url?: string;
    title?: string;
    description?: string;
    date?: string;
    imageUrl?: string;
    county?: string;
}

interface ArticleItem {
    title: string;
    link: string;
    source: string;
    date: string;
    imageUrl?: string;
    description?: string;
    counties?: string[];
    cities?: string[];
    tags?: string[];
}

function buildPayload(targetUrl: string, additionalProperties?: Record<string, unknown>) {
    const baseProps: Record<string, unknown> = {
        url: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        date: { type: "string" },
        imageUrl: { type: "string" },
    };
    const properties = { ...baseProps, ...(additionalProperties || {}) };
    return {
        url: targetUrl,
        onlyMainContent: true,
        maxAge: 10800000,
        formats: [
            {
                type: "json",
                schema: {
                    type: "object",
                    required: [],
                    properties: {
                        articles: {
                            type: "array",
                            items: {
                                type: "object",
                                required: [],
                                properties,
                            },
                        },
                    },
                },
            },
        ],
    };
}

async function scrapeWithFirecrawl(targetUrl: string, sourceName: string, feedKey: string) {
    const scrapeStartTime = Date.now();
    console.log(`🕷️ Starting Firecrawl scrape for ${sourceName}`);

    const apiKey = process.env.FIRECRAWL_API_KEY || "";
    const payload = buildPayload(targetUrl);

    const firecrawlStartTime = Date.now();
    const res = await pRetry(
        async () => {
            const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                cache: "no-store",
            });

            // Throw error for 5xx errors to trigger retry
            if (response.status >= 500 && response.status < 600) {
                throw new Error(`Firecrawl server error: ${response.status}`);
            }

            return response;
        },
        {
            retries: 3,
            onFailedAttempt: (error) => {
                console.log(`⚠️ Firecrawl request failed (attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber}):`, JSON.stringify(error));
            },
        },
    );
    const firecrawlTime = Date.now() - firecrawlStartTime;
    console.log(`⏱️ Firecrawl API call completed in ${firecrawlTime}ms`);

    if (!res.ok) {
        throw new Error(`Firecrawl scrape failed for ${sourceName}: ${res.status}`);
    }

    const parseStartTime = Date.now();
    const json = await res.json();
    const data = (json?.data?.json?.articles || []) as ScrapedArticleRaw[];
    const parseTime = Date.now() - parseStartTime;
    console.log(`⏱️ JSON parsing completed in ${parseTime}ms`);

    const mappingStartTime = Date.now();
    const mapped: ArticleItem[] = data.map((a) => {
        return {
            title: a.title || "",
            link: a.url || "",
            source: feedKey,
            date: safeDateToISO(a.date),
            imageUrl: sanitizeImageUrl(a.imageUrl || ""),
            description: a.description || "",
        };
    });
    const mappingTime = Date.now() - mappingStartTime;

    const totalScrapeTime = Date.now() - scrapeStartTime;
    console.log(`⏱️ Article mapping completed in ${mappingTime}ms`);
    console.log(`📊 Firecrawl scrape summary for ${sourceName}:`);
    console.log(`   🕷️ Firecrawl API: ${firecrawlTime}ms`);
    console.log(`   📄 JSON parsing: ${parseTime}ms`);
    console.log(`   🗺️ Mapping: ${mappingTime}ms`);
    console.log(`   🎯 Total: ${totalScrapeTime}ms`);
    console.log(`   📰 Articles: ${mapped.length}`);

    return mapped;
}

// Helper function to save articles to DB using Drizzle
async function saveArticlesToDatabase(articleItems: ArticleItem[], sourceId: string, sourceName?: string, isCategorized: boolean = false): Promise<number> {
    let saved = 0;

    // Ensure source exists in sources table
    await db
        .insert(sources)
        .values({
            sourceId: sourceId,
            sourceName: sourceName || sourceId,
        })
        .onConflictDoNothing();

    for (const article of articleItems) {
        try {
            const articleSourceId = article.source || sourceId;

            // Ensure the article's source exists
            if (articleSourceId !== sourceId) {
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
                // Article already exists, skip
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
                    isCategorized: isCategorized,
                })
                .returning({ id: articles.id })
                .onConflictDoNothing();

            if (!createdArticle) continue;

            // Only insert counties, cities, and tags if article is categorized
            if (isCategorized) {
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
            }

            saved++;
        } catch (error) {
            console.error(`Error saving article ${article.link}:`, error);
        }
    }

    return saved;
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    try {
        console.log("🚀 CRON JOB STARTED - Firecrawl Processing");
        console.log("⏰ Timestamp:", new Date().toISOString());

        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.log("❌ UNAUTHORIZED: Invalid or missing auth header");
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        console.log("✅ Authentication successful");

        const results: Record<string, { loaded: number }> = {};
        const today = new Date().toISOString().split("T")[0];
        console.log("📅 Processing date:", today);

        // Process Firecrawl sources in parallel
        const firecrawlStartTime = Date.now();

        // Fetch Firecrawl sources from database
        const firecrawlSources = await getFirecrawlSources();

        console.log("🔍 Starting Firecrawl processing for", firecrawlSources.length, "sources");
        const firecrawlPromises = firecrawlSources.map(async (source) => {
            try {
                if (!source.url) {
                    console.warn(`⚠️ Firecrawl source ${source.sourceId} has no URL, skipping`);
                    return { key: source.sourceId, loaded: 0 };
                }

                console.log(`📰 Processing ${source.sourceId} (${source.sourceName})`);
                const scraped = await scrapeWithFirecrawl(source.url, source.sourceName, source.sourceId);
                console.log(`✅ ${source.sourceId}: Found ${scraped.length} articles`);
                const savedCount = await saveArticlesToDatabase(scraped, source.sourceId, source.sourceName);
                console.log(`💾 Saved ${savedCount} articles to database for ${source.sourceId}`);
                return { key: source.sourceId, loaded: savedCount };
            } catch (error) {
                console.error(`❌ Error processing ${source.sourceId}:`, error);
                return { key: source.sourceId, loaded: 0 };
            }
        });

        const firecrawlResults = await Promise.allSettled(firecrawlPromises);
        timings.firecrawl = Date.now() - firecrawlStartTime;
        console.log(`⏱️ Firecrawl processing completed in ${timings.firecrawl}ms`);

        firecrawlResults.forEach((result: PromiseSettledResult<{ key: string; loaded: number }>, index: number) => {
            if (result.status === "fulfilled") {
                results[result.value.key] = { loaded: result.value.loaded };
            } else {
                const source = firecrawlSources[index];
                console.warn(`❌ ${source?.sourceId || "unknown"} failed:`, result.reason);
                if (source) {
                    results[source.sourceId] = { loaded: 0 };
                }
            }
        });

        const totalTime = Date.now() - startTime;
        timings.total = totalTime;

        console.log("📊 FINAL RESULTS:", results);
        console.log("⏱️ TIMING BREAKDOWN:");
        console.log(`   🔍 Firecrawl: ${timings.firecrawl}ms`);
        console.log(`   🎯 Total: ${timings.total}ms`);
        console.log("🎉 CRON JOB COMPLETED SUCCESSFULLY");
        return NextResponse.json({ ok: true, results, timings });
    } catch (error: any) {
        console.error("Error in GET /api/news/scrape-firecrawl:", error);
        return NextResponse.json({ ok: false, error: error.message || "Internal server error" }, { status: 500 });
    }
}
