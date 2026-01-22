import { makeGeminiCall } from "@/lib/news/gemini";

interface ArticleItem {
    id: string;
    title: string;
    link: string;
    source_name: string;
    date: string;
    image_url?: string | null;
    description?: string | null;
    counties?: string[];
    tags?: string[];
}

export async function searchArticlesWithGemini(articles: ArticleItem[], query: string): Promise<ArticleItem[]> {
    if (articles.length === 0) {
        return articles;
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.warn("GEMINI_API_KEY not set, returning first 20 articles as fallback");
        return articles.slice(0, 20);
    }

    try {
        const prompt = `You are a real estate news search engine. A user is searching for: "${query}"

Given the following articles, select the TOP 20 MOST RELEVANT articles that match their search query. Consider relevance to the search terms, recency, and quality of content. Return ONLY the article indices (0-based) in order of relevance.

Articles:
${articles.map((article, index) => `${index}. Title: ${article.title}\n   Description: ${article.description || 'No description'}\n   Source: ${article.source_name}\n   Date: ${article.date}`).join('\n\n')}

Return a JSON array of indices, e.g. [3, 7, 1, 9, 2, 5, 8, 4, 6, 0]`;

        const result = await makeGeminiCall("gemini-2.5-flash-lite", prompt, {
            operation: "search-articles",
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "INTEGER"
                }
            }
        });

        const text = result.candidates[0].content.parts[0].text;
        const selectedIndices = JSON.parse(text);

        // Filter articles based on selected indices
        const filteredArticles = selectedIndices
            .filter((index: number) => index >= 0 && index < articles.length)
            .map((index: number) => articles[index])
            .slice(0, 20); // Ensure max 20 articles

        console.log(`Gemini selected ${filteredArticles.length} articles out of ${articles.length} for search query: "${query}"`);
        return filteredArticles;

    } catch (error) {
        console.error('Error searching articles with Gemini:', error);
        // Return first 20 articles as fallback
        return articles.slice(0, 20);
    }
}
