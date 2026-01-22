import { makeGeminiCall } from "@/lib/news/gemini";

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
}

export async function filterArticlesByInterests(
  articles: ArticleItem[],
  interests: string,
  maxArticles: number,
  promptName: string,
  additionalVariables: Record<string, string> = {},
  geminiModel?: string
): Promise<ArticleItem[]> {
  if (!interests || interests.trim() === '') {
    return articles;
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn("GEMINI_API_KEY not set, skipping interest-based filtering");
    return articles;
  }

  try {
    const model = geminiModel || "gemini-3-flash-preview";

    // Format articles for the prompt
    const articlesText = articles.map((article, index) => {
      const tags = article.tags && article.tags.length > 0 ? article.tags.join(', ') : 'none';
      const counties = article.counties && article.counties.length > 0 ? article.counties.join(', ') : 'none';
      const cities = article.cities && article.cities.length > 0 ? article.cities.join(', ') : 'none';
      return `${index}. Title: ${article.title}\n   Description: ${article.description || 'No description'}\n   Source: ${article.source}\n   Date: ${article.date}\n   Tags: ${tags}\n   Counties: ${counties}\n   Cities: ${cities}`;
    }).join('\n\n');

    const countiesStr = additionalVariables.counties || '';
    const citiesStr = additionalVariables.cities || '';

    const prompt = promptName === 'filter-national-articles'
      ? `You are a real estate news curator. Select the ${maxArticles} most relevant articles for a subscriber with these interests:

"${interests}"

Articles:
${articlesText}

Return a JSON array of objects with "index" (0-based article index) and "rationale" (brief explanation of why this article is relevant).
Select up to ${maxArticles} articles that best match the subscriber's interests. Prioritize articles from LinkedIn sources when multiple articles cover similar topics.

Example: [{"index": 0, "rationale": "Discusses multifamily investment trends relevant to subscriber's interest in apartment acquisitions"}, {"index": 2, "rationale": "Covers financing conditions that affect commercial real estate"}]`
      : `You are a real estate news curator. Select the ${maxArticles} most relevant LOCAL articles for a subscriber with these interests:

"${interests}"

Subscriber's preferred counties: ${countiesStr || 'all'}
Subscriber's preferred cities: ${citiesStr || 'all'}

Articles:
${articlesText}

Return a JSON array of objects with "index" (0-based article index) and "rationale" (brief explanation of why this article is relevant).
Select up to ${maxArticles} articles that best match:
1. The subscriber's geographic preferences (counties/cities)
2. The subscriber's stated interests

Example: [{"index": 1, "rationale": "Covers development in San Francisco which matches subscriber's county preference"}, {"index": 4, "rationale": "Discusses retail trends in Oakland relevant to subscriber's commercial interests"}]`;

    const result = await makeGeminiCall(model, prompt, {
      operation: promptName,
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            index: {
              type: "INTEGER"
            },
            rationale: {
              type: "STRING"
            }
          },
          required: ["index", "rationale"]
        }
      },
      properties: {
        promptName,
        interests,
        articleCount: articles.length,
      }
    });

    const selectedItems = JSON.parse(result.candidates[0].content.parts[0].text) as Array<{ index: number; rationale: string }>;

    // Filter articles based on selected indices and attach rationales
    const filteredArticles = selectedItems
      .filter((item) => item.index >= 0 && item.index < articles.length)
      .slice(0, maxArticles)
      .map((item) => ({
        ...articles[item.index],
        rationale: item.rationale
      }));

    console.log(`Gemini selected ${filteredArticles.length} articles out of ${articles.length} using prompt "${promptName}"`);
    return filteredArticles;

  } catch (error) {
    console.error(`Error filtering articles with prompt "${promptName}":`, error);
    // Return first maxArticles articles as fallback
    return articles.slice(0, maxArticles);
  }
}

/**
 * Filter national articles based on subscriber interests
 */
export async function filterNationalArticlesByInterests(
  articles: ArticleItem[],
  interests: string,
  maxArticles: number,
  geminiModel?: string
): Promise<ArticleItem[]> {
  return filterArticlesByInterests(
    articles,
    interests,
    maxArticles,
    'filter-national-articles',
    {},
    geminiModel
  );
}

/**
 * Filter local articles based on subscriber interests and counties
 */
export async function filterLocalArticlesByInterests(
  articles: ArticleItem[],
  interests: string,
  maxArticles: number,
  geminiModel?: string,
  counties: string[] = [],
  cities: string[] = []
): Promise<ArticleItem[]> {
  return filterArticlesByInterests(
    articles,
    interests,
    maxArticles,
    'filter-local-articles',
    {
      counties: counties.join(', '),
      cities: cities.join(', ')
    },
    geminiModel
  );
}
