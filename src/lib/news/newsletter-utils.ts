import { createClient } from "@/utils/supabase/server";
import { filterArticlesBeforeLastWeek } from "@/lib/news/news-sources";
import { filterLocalArticlesByInterests, filterNationalArticlesByInterests } from "@/lib/news/personalization";

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
  rationale?: string;
  isNational?: boolean;
}

// Return type for newsletter articles with separate National and Local sections
export interface NewsletterArticles {
  nationalArticles: Array<{ title: string, link: string, description: string, date: string, source: string, imageUrl?: string, tags?: string[], counties?: string[], cities?: string[], rationale?: string }>;
  localArticles: Array<{ title: string, link: string, description: string, date: string, source: string, imageUrl?: string, tags?: string[], counties?: string[], cities?: string[], rationale?: string }>;
}

// Helper function to fetch articles from database for newsletter
export async function fetchArticlesForNewsletter(counties?: string[], cities?: string[], interests?: string, geminiModel?: string): Promise<NewsletterArticles> {
  try {
    const supabase = await createClient();

    // Calculate date range (last 7 days)
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Fetch articles from the last week
    const { data: articles, error } = await supabase
      .from("articles")
      .select(`
        id,
        title,
        link,
        date,
        image_url,
        description,
        source_id,
        sources (source_name, is_national),
        article_counties (
          county_id,
          counties (name)
        ),
        article_cities (city),
        article_tags (tag)
      `)
      .gte("date", oneWeekAgo.toISOString())
      .lte("date", now.toISOString())
      .eq("is_relevant", true)
      .eq("is_categorized", true)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching articles:", error);
      return { nationalArticles: [], localArticles: [] };
    }

    // Map to ArticleItem format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: ArticleItem[] = (articles || []).map((article: any) => {
      // Handle sources - Supabase returns object for 1-to-1 relations
      const sourceData = article.sources;
      const sourceName = sourceData?.source_name || article.source_id;
      const isNational = sourceData?.is_national || false;

      // Handle article_counties - filter out nulls properly
      const counties = (article.article_counties || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => c.counties?.name)
        .filter((name: unknown): name is string => name !== null && name !== undefined);

      return {
        title: article.title,
        link: article.link,
        source: sourceName,
        date: article.date,
        imageUrl: article.image_url || undefined,
        description: article.description || undefined,
        counties,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cities: (article.article_cities || []).map((c: any) => c.city),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tags: (article.article_tags || []).map((t: any) => t.tag),
        isNational
      };
    });

    // Filter articles published in the last week and ensure description is present
    const timeFilteredArticles = filterArticlesBeforeLastWeek(results);

    // Split articles into National and Local
    const { nationalArticles, localArticles } = splitArticlesIntoNationalAndLocal(timeFilteredArticles, counties, cities);

    // Apply interest-based filtering using Gemini if interests are provided
    let finalNationalArticles = nationalArticles;
    let finalLocalArticles = localArticles;

    if (interests && interests.trim() !== '') {
      console.log(`Applying Gemini interest filtering for: "${interests}"`);

      // Filter National articles separately (top 5) with LinkedIn preference
      if (nationalArticles.length > 0) {
        finalNationalArticles = await filterNationalArticlesByInterests(nationalArticles, interests, 5, geminiModel);
        console.log(`Selected ${finalNationalArticles.length} National articles out of ${nationalArticles.length}`);
      }

      // Filter Local articles separately (top 10)
      if (localArticles.length > 0) {
        finalLocalArticles = await filterLocalArticlesByInterests(localArticles, interests, 10, geminiModel, counties || [], cities || []);
        console.log(`Selected ${finalLocalArticles.length} Local articles out of ${localArticles.length}`);
      }
    } else {
      // If no interests, just take top 5 National and top 10 Local by date
      finalNationalArticles = nationalArticles.slice(0, 5);
      finalLocalArticles = localArticles.slice(0, 10);
    }

    // Map to return format
    const mapArticle = (article: ArticleItem) => ({
      title: article.title,
      link: article.link,
      description: article.description || '',
      date: article.date,
      source: article.source,
      imageUrl: article.imageUrl,
      tags: article.tags || [],
      counties: article.counties || [],
      cities: article.cities || [],
      rationale: article.rationale
    });

    return {
      nationalArticles: finalNationalArticles.map(mapArticle),
      localArticles: finalLocalArticles.map(mapArticle)
    };
  } catch (error) {
    console.error('Error fetching articles from database:', error);
    return {
      nationalArticles: [],
      localArticles: []
    };
  }
}

// Helper function to split articles into National and Local sections
export function splitArticlesIntoNationalAndLocal<T extends { counties?: string[]; cities?: string[]; tags?: string[]; isNational?: boolean }>(
  articles: T[],
  selectedCounties?: string[],
  selectedCities?: string[]
): { nationalArticles: T[]; localArticles: T[] } {
  const nationalArticles: T[] = [];
  const localArticles: T[] = [];

  for (const article of articles) {
    const articleCounties = article.counties || [];
    const articleCities = article.cities || [];
    const articleTags = article.tags || [];

    // Prefilter: National articles must be from isNational sources and have the national or economy tag
    if (article.isNational === true && (articleTags.includes('national') || articleTags.includes('economy'))) {
      nationalArticles.push(article);
    }
    // Local articles: match selected counties OR selected cities
    const matchesCounty = selectedCounties && selectedCounties.length > 0
      ? selectedCounties.some(county => articleCounties.includes(county))
      : false;

    const matchesCity = selectedCities && selectedCities.length > 0
      ? selectedCities.some(city => articleCities.includes(city))
      : false;

    // If no locations selected, include all local articles (or if matched)
    const noLocationsSelected = (!selectedCounties || selectedCounties.length === 0) && (!selectedCities || selectedCities.length === 0);

    if (matchesCounty || matchesCity || noLocationsSelected) {
      localArticles.push(article);
    }
  }

  return { nationalArticles, localArticles };
}


// Helper function to generate email content from articles with separate National and Local sections
export function generateEmailContentFromArticles(
  nationalArticles: Array<{ title: string, link: string, description: string, date: string, source: string, imageUrl?: string, tags?: string[], counties?: string[], cities?: string[], rationale?: string }>,
  localArticles: Array<{ title: string, link: string, description: string, date: string, source: string, imageUrl?: string, tags?: string[], counties?: string[], cities?: string[], rationale?: string }>
): string {
  if (nationalArticles.length === 0 && localArticles.length === 0) {
    console.log('No articles to include in email content');
    return '<p>No new articles available.</p>';
  }

  console.log(`Generating email content with ${nationalArticles.length} National and ${localArticles.length} Local articles`);

  let content = '';

  // Helper function to generate article HTML
  const generateArticleHtml = (article: { title: string, link: string, description: string, date: string, source: string, imageUrl?: string, tags?: string[], counties?: string[], cities?: string[], rationale?: string }) => {
    const articleDate = new Date(article.date);
    const formattedDate = articleDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Regular tags
    const tagsHtml = Array.isArray(article.tags) && article.tags.length > 0
      ? `<p class="article-tags" style="margin: 6px 0 0 0;">
           ${article.tags.map(t => `<span style="display:inline-block;margin-right:6px;margin-top:6px;padding:2px 8px;border-radius:9999px;background:#fff3e8;color:#9a3412;border:1px solid #ffddb8;font-size:11px;">${t}</span>`).join('')}
         </p>`
      : '';

    // Geographic tags (counties and cities) on separate line
    const geographicTags: string[] = [];
    if (Array.isArray(article.counties) && article.counties.length > 0) {
      geographicTags.push(...article.counties.map(c => `County: ${c}`));
    }
    if (Array.isArray(article.cities) && article.cities.length > 0) {
      geographicTags.push(...article.cities.map(c => `City: ${c}`));
    }

    const geographicTagsHtml = geographicTags.length > 0
      ? `<p class="article-geographic-tags" style="margin: 6px 0 0 0;">
           ${geographicTags.map(t => `<span style="display:inline-block;margin-right:6px;margin-top:6px;padding:2px 8px;border-radius:9999px;background:#e0f2fe;color:#0c4a6e;border:1px solid #bae6fd;font-size:11px;">${t}</span>`).join('')}
         </p>`
      : '';

    const rationaleHtml = article.rationale
      ? `<p class="article-rationale" style="font-size: 11px; color: #888; font-style: italic; margin: 4px 0 0 0; padding: 4px; background-color: #f5f5f5; border-left: 3px solid #ccc;">
           <strong>Why this article:</strong> ${article.rationale}
         </p>`
      : '';

    return `
      <div class="article">
        <h3><a href="${article.link}" target="_blank">${article.title}</a></h3>
        <p>${article.description.substring(0, 400)}${article.description.length > 400 ? '...' : ''}</p>
        <p class="article-meta" style="font-size: 12px; color: #666; margin: 5px 0 0 0;">
          ${formattedDate} | ${article.source}
        </p>
        ${tagsHtml}
        ${geographicTagsHtml}
        ${rationaleHtml}
      </div>
    `;
  };

  // National News Section
  if (nationalArticles.length > 0) {
    content += '<div class="section-header" style="font-size: 20px; font-weight: bold; color: #2c3e50; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #2c3e50;">National</div>';
    nationalArticles.forEach((article, index) => {
      const rationaleText = article.rationale ? ` - ${article.rationale}` : '';
      console.log(`  Including National article ${index + 1}: "${article.title}"${rationaleText}`);
      content += generateArticleHtml(article);
    });
  }

  // Local News Section
  if (localArticles.length > 0) {
    content += '<div class="section-header" style="font-size: 20px; font-weight: bold; color: #2c3e50; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #2c3e50;">Local</div>';
    localArticles.forEach((article, index) => {
      const rationaleText = article.rationale ? ` - ${article.rationale}` : '';
      console.log(`  Including Local article ${index + 1}: "${article.title}"${rationaleText}`);
      content += generateArticleHtml(article);
    });
  }

  console.log(`Generated email content length: ${content.length} characters`);
  return content;
}
