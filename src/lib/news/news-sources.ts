// Centralized definitions of news markets and sources

import { createClient } from "@/utils/supabase/server";

// Helper function to sanitize image URLs by removing query parameters
export function sanitizeImageUrl(url?: string): string {
  if (!url) return "";
  const questionMarkIndex = url.indexOf("?");
  return questionMarkIndex === -1 ? url : url.substring(0, questionMarkIndex);
}

// Helper function to filter articles published before a specific date
export function filterArticlesByDate<T extends {date: string}>(articles: T[], beforeDate: Date): T[] {
  return articles.filter(article => {
    const articleDate = new Date(article.date);
    return articleDate < beforeDate;
  });
}

// Helper function to get articles published in the last week (recent articles)
export function filterArticlesBeforeLastWeek<T extends {date: string}>(articles: T[]): T[] {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const now = new Date();

  return articles.filter(article => {
    const articleDate = new Date(article.date);
    // Only include articles from the last week (not older than 7 days, not in the future)
    return articleDate >= oneWeekAgo && articleDate <= now;
  });
}

// Fetch RSS feeds from database
export async function getRssFeeds() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sources")
    .select("source_id, source_name, url, type")
    .eq("type", "rss")
    .eq("disabled", false)
    .order("source_name", { ascending: true });

  if (error) {
    console.error("Error fetching RSS feeds:", error);
    return [];
  }

  return data.map(source => ({
    sourceId: source.source_id,
    sourceName: source.source_name,
    url: source.url,
    type: source.type,
  }));
}

// Fetch Firecrawl sources from database
export async function getFirecrawlSources() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sources")
    .select("source_id, source_name, url, type")
    .eq("type", "firecrawl")
    .eq("disabled", false)
    .order("source_name", { ascending: true });

  if (error) {
    console.error("Error fetching Firecrawl sources:", error);
    return [];
  }

  return data.map(source => ({
    sourceId: source.source_id,
    sourceName: source.source_name,
    url: source.url,
    type: source.type,
  }));
}

// Fetch LinkedIn profiles from database
export async function getLinkedInProfiles() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sources")
    .select("source_id, source_name, url, type")
    .eq("type", "linkedin")
    .eq("disabled", false)
    .order("source_name", { ascending: true });

  if (error) {
    console.error("Error fetching LinkedIn profiles:", error);
    return [];
  }

  return data.map(source => ({
    sourceId: source.source_id,
    sourceName: source.source_name,
    url: source.url,
    type: source.type,
  }));
}
