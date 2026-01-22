import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sanitizeImageUrl, getRssFeeds } from "@/lib/news/news-sources";
import { getCountyIds } from "@/lib/news/counties";
import Parser from "rss-parser";

export const dynamic = "force-dynamic";

// RSS types
interface RSSMediaAttributes {
  type?: string;
  url?: string;
  medium?: string;
}

interface RSSMedia {
  $?: RSSMediaAttributes;
  type?: string;
  url?: string;
}

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  description?: string;
  contentEncoded?: string;
  contentSnippet?: string;
  summary?: string;
  mediaContent?: RSSMedia | RSSMedia[];
  mediaThumbnail?: { $?: { url?: string } };
  enclosure?: { type?: string; url?: string };
}

const parser: Parser<unknown, RSSItem> = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
    ]
  }
});

// Helper function to safely convert date strings to ISO format
function safeDateToISO(dateString?: string): string {
  try {
    return new Date(dateString || '').toISOString();
  } catch {
    return new Date().toISOString();
  }
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

// Helper function to extract image URL from RSS item
function extractImageUrl(item: RSSItem): string | undefined {
  // Try media:content first (higher resolution)
  if (item.mediaContent) {
    const mediaItems = Array.isArray(item.mediaContent) ? item.mediaContent : [item.mediaContent];
    const imageContent = mediaItems.find((media: RSSMedia) =>
      Boolean(
        (media.$?.type && media.$.type.startsWith('image/')) ||
        (media.$?.medium && media.$.medium === 'image')
      )
    );
    if (imageContent?.$?.url) {
      return imageContent.$.url;
    }
  }

  // Try enclosure for images
  if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
    return item.enclosure.url;
  }

  // Try media:thumbnail as fallback (lower resolution)
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }

  // Extract from content or description HTML
  const content = item.contentEncoded || item.content || item.description || '';
  if (content) {
    const imgMatch = content.match(/<img[^>]+src=["']([^"'>]+)["'][^>]*>/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  return undefined;
}

// Helper function to extract and clean description from RSS item
function extractDescription(item: RSSItem): string | undefined {
  // Try contentSnippet first (clean text version)
  if (item.contentSnippet && item.contentSnippet.trim()) {
    return item.contentSnippet.trim();
  }

  // Try summary
  if (item.summary && item.summary.trim()) {
    const cleanSummary = item.summary.replace(/<[^>]*>/g, '').trim();
    return cleanSummary;
  }

  // Try description and clean HTML
  if (item.description && item.description.trim()) {
    const cleanDescription = item.description.replace(/<[^>]*>/g, '').trim();
    return cleanDescription;
  }

  return undefined;
}

async function fetchOpenGraphImage(articleUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(articleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    const html = await response.text();
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    if (ogImageMatch) {
      return sanitizeImageUrl(ogImageMatch[1]);
    }
  } catch (error) {
    // Silently fail if we can't fetch the page
    console.warn(`Could not fetch OpenGraph image for ${articleUrl}:`, error);
  }
  return undefined;
}

// Helper function to save articles to Supabase with proper handling of relations
async function saveArticlesToDatabase(articles: ArticleItem[], sourceId: string, sourceName?: string, isCategorized: boolean = false): Promise<number> {
  let saved = 0;
  const supabase = await createClient();

  // Ensure source exists in sources table
  const { error: upsertError } = await supabase
    .from("sources")
    .upsert({
      source_id: sourceId,
      source_name: sourceName || sourceId,
    }, { onConflict: "source_id" });

  if (upsertError) {
    console.error("Error upserting source:", upsertError);
  }

  for (const article of articles) {
    try {
      // Use article.source if provided, otherwise use the passed sourceId
      const articleSourceId = article.source || sourceId;

      // Ensure the article's source exists
      if (articleSourceId !== sourceId) {
        await supabase
          .from("sources")
          .upsert({
            source_id: articleSourceId,
            source_name: articleSourceId,
          }, { onConflict: "source_id" });
      }

      // Upsert article (ON CONFLICT DO NOTHING pattern)
      const { data: createdArticle, error: articleError } = await supabase
        .from("articles")
        .upsert({
          link: article.link,
          title: article.title,
          source_id: articleSourceId,
          date: new Date(article.date).toISOString(),
          image_url: article.imageUrl || null,
          description: article.description || null,
          is_categorized: isCategorized,
        }, { onConflict: "link", ignoreDuplicates: true })
        .select("id")
        .single();

      if (articleError) {
        // Skip duplicates
        if (articleError.code === '23505') continue;
        console.error(`Error saving article ${article.link}:`, articleError);
        continue;
      }

      if (!createdArticle) continue;

      // Only insert counties, cities, and tags if article is categorized
      if (isCategorized) {
        // Insert counties
        if (article.counties && article.counties.length > 0) {
          const countyIds = await getCountyIds(article.counties);
          const countyLinks = countyIds.map(countyId => ({
            article_id: createdArticle.id,
            county_id: countyId
          }));

          await supabase
            .from("article_counties")
            .upsert(countyLinks, { onConflict: "article_id,county_id", ignoreDuplicates: true });
        }

        // Insert cities
        if (article.cities && article.cities.length > 0) {
          const cityLinks = article.cities.map(city => ({
            article_id: createdArticle.id,
            city: city
          }));

          await supabase
            .from("article_cities")
            .upsert(cityLinks, { onConflict: "article_id,city", ignoreDuplicates: true });
        }

        // Insert tags
        if (article.tags && article.tags.length > 0) {
          const tagLinks = article.tags.map(tag => ({
            article_id: createdArticle.id,
            tag: tag
          }));

          await supabase
            .from("article_tags")
            .upsert(tagLinks, { onConflict: "article_id,tag", ignoreDuplicates: true });
        }
      }

      saved++;
    } catch (error) {
      console.error(`Error saving article ${article.link}:`, error);
    }
  }

  return saved;
}

async function processRSSFeeds(): Promise<ArticleItem[]> {
  const allRSSArticles: ArticleItem[] = [];

  // Fetch RSS feeds from database
  const rssFeeds = await getRssFeeds();

  // Process regular RSS feeds in parallel
  const rssFetchStartTime = Date.now();
  const rssPromises = rssFeeds.map(async (feed) => {
    try {
      if (!feed.url) {
        console.warn(`RSS feed ${feed.sourceId} has no URL, skipping`);
        return [];
      }

      const parsedFeed = await parser.parseURL(feed.url);

       const rssArticles: ArticleItem[] = await Promise.all(
         (parsedFeed.items as RSSItem[])
           .map(async (item: RSSItem) => {
             let imageUrl = sanitizeImageUrl(extractImageUrl(item));

             // If no imageUrl, try to fetch OpenGraph image
             if (!imageUrl && item.link) {
               imageUrl = await fetchOpenGraphImage(item.link) || "";
             }

             return {
               title: item.title || "",
               link: item.link || "",
               source: feed.sourceId,
               date: safeDateToISO(item.pubDate),
               imageUrl,
               description: extractDescription(item),
             };
           })
       );

       return rssArticles;
    } catch (feedError) {
      console.error(`Error fetching ${feed.sourceName} feed:`, feedError);
      return [];
    }
  });

  const rssResults = await Promise.all(rssPromises);
  allRSSArticles.push(...rssResults.flat());
  const rssFetchTime = Date.now() - rssFetchStartTime;
  console.log(`RSS fetch completed in ${rssFetchTime}ms`);

  return allRSSArticles;
}

export async function GET(request: Request) {
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    try {
        console.log('CRON JOB STARTED - RSS Feed Processing');
        console.log('Timestamp:', new Date().toISOString());

        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.log('UNAUTHORIZED: Invalid or missing auth header');
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        console.log('Authentication successful');

        const results: Record<string, { loaded: number }> = {};
        const today = new Date().toISOString().split("T")[0];
        console.log('Processing date:', today);

        const supabase = await createClient();

        // Process RSS feeds
        const rssStartTime = Date.now();
        console.log('Starting RSS feed processing...');
        try {
            const rssArticles = await processRSSFeeds();
            timings.rss = Date.now() - rssStartTime;
            console.log(`RSS: Found ${rssArticles.length} articles`);
            console.log(`RSS processing completed in ${timings.rss}ms`);

            // Group articles by their sourceId and save them with the correct source info
            const articlesBySource = new Map<string, typeof rssArticles>();
            for (const article of rssArticles) {
              if (!articlesBySource.has(article.source)) {
                articlesBySource.set(article.source, []);
              }
              articlesBySource.get(article.source)!.push(article);
            }

            // Save articles grouped by source
            let totalSaved = 0;
            for (const [sourceId, articles] of articlesBySource.entries()) {
              // Get the source name from database
              const { data: source } = await supabase
                .from("sources")
                .select("source_name")
                .eq("source_id", sourceId)
                .single();

              const saved = await saveArticlesToDatabase(articles, sourceId, source?.source_name || sourceId);
              totalSaved += saved;
              console.log(`Saved ${saved} articles from ${sourceId} to database`);
            }

            results["rss"] = { loaded: totalSaved };
        } catch (error) {
            timings.rss = Date.now() - rssStartTime;
            console.error('Error processing RSS feeds:', error);
            console.log(`RSS processing failed after ${timings.rss}ms`);
            results["rss"] = { loaded: 0 };
        }

        const totalTime = Date.now() - startTime;
        timings.total = totalTime;

        console.log('FINAL RESULTS:', results);
        console.log('TIMING BREAKDOWN:');
        console.log(`   RSS: ${timings.rss}ms`);
        console.log(`   Total: ${timings.total}ms`);
        console.log('CRON JOB COMPLETED SUCCESSFULLY');
        return NextResponse.json({ ok: true, results, timings });
    } catch (error) {
        return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
}
