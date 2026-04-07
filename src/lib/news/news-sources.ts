// Centralized definitions of news markets and sources
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema";

// Helper function to sanitize image URLs by removing query parameters
export function sanitizeImageUrl(url?: string): string {
    if (!url) return "";
    const questionMarkIndex = url.indexOf("?");
    return questionMarkIndex === -1 ? url : url.substring(0, questionMarkIndex);
}

// Helper function to filter articles published before a specific date
export function filterArticlesByDate<T extends { date: string }>(articles: T[], beforeDate: Date): T[] {
    return articles.filter((article) => {
        const articleDate = new Date(article.date);
        return articleDate < beforeDate;
    });
}

// Helper function to get articles published in the last week (recent articles)
export function filterArticlesBeforeLastWeek<T extends { date: string }>(articles: T[]): T[] {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const now = new Date();

    return articles.filter((article) => {
        const articleDate = new Date(article.date);
        // Only include articles from the last week (not older than 7 days, not in the future)
        return articleDate >= oneWeekAgo && articleDate <= now;
    });
}

// Fetch RSS feeds from database
export async function getRssFeeds() {
    try {
        const rows = await db
            .select({ sourceId: sources.sourceId, sourceName: sources.sourceName, url: sources.url, type: sources.type })
            .from(sources)
            .where(eq(sources.type, "rss"))
            .orderBy(asc(sources.sourceName));

        return rows.map((source) => ({
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            url: source.url,
            type: source.type,
        }));
    } catch (error) {
        console.error("Error fetching RSS feeds:", error);
        return [];
    }
}

// Fetch Firecrawl sources from database
export async function getFirecrawlSources() {
    try {
        const rows = await db
            .select({ sourceId: sources.sourceId, sourceName: sources.sourceName, url: sources.url, type: sources.type })
            .from(sources)
            .where(eq(sources.type, "firecrawl"))
            .orderBy(asc(sources.sourceName));

        return rows.map((source) => ({
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            url: source.url,
            type: source.type,
        }));
    } catch (error) {
        console.error("Error fetching Firecrawl sources:", error);
        return [];
    }
}

// Fetch LinkedIn profiles from database
export async function getLinkedInProfiles() {
    try {
        const rows = await db
            .select({ sourceId: sources.sourceId, sourceName: sources.sourceName, url: sources.url, type: sources.type })
            .from(sources)
            .where(eq(sources.type, "linkedin"))
            .orderBy(asc(sources.sourceName));

        return rows.map((source) => ({
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            url: source.url,
            type: source.type,
        }));
    } catch (error) {
        console.error("Error fetching LinkedIn profiles:", error);
        return [];
    }
}
