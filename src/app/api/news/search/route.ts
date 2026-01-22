import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { searchArticlesWithGemini } from "@/lib/news/search";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { query, dateRange } = body;

        if (!query || query.trim() === "") {
            return NextResponse.json(
                { error: "Search query is required" },
                { status: 400 }
            );
        }

        // Build date filter
        const now = new Date();
        let cutoffDate: Date | null = null;

        if (dateRange && dateRange !== "all") {
            cutoffDate = new Date();
            switch (dateRange) {
                case "last-week":
                    cutoffDate.setDate(now.getDate() - 7);
                    break;
                case "last-month":
                    cutoffDate.setMonth(now.getMonth() - 1);
                    break;
                case "last-3-months":
                    cutoffDate.setMonth(now.getMonth() - 3);
                    break;
                case "last-year":
                    cutoffDate.setFullYear(now.getFullYear() - 1);
                    break;
                default:
                    cutoffDate.setDate(now.getDate() - 7);
            }
        }

        // Fetch articles from database
        let dbQuery = supabase
            .from("articles")
            .select(
                `
        id,
        title,
        link,
        description,
        image_url,
        date,
        source_id,
        sources!articles_source_id_fkey (
          source_name
        ),
        article_counties (
          counties (
            name
          )
        ),
        article_tags (
          tag
        )
      `
            )
            .eq("is_relevant", true)
            .order("date", { ascending: false })
            .limit(100); // Limit to 100 for LLM processing

        if (cutoffDate) {
            dbQuery = dbQuery.gte("date", cutoffDate.toISOString());
        }

        const { data: articles, error: dbError } = await dbQuery;

        if (dbError) {
            console.error("Error fetching articles for search:", dbError);
            return NextResponse.json(
                { error: "Failed to fetch articles" },
                { status: 500 }
            );
        }

        // Transform the data
        const transformedArticles = (articles || []).map((article: any) => ({
            id: article.id,
            title: article.title,
            link: article.link,
            description: article.description,
            image_url: article.image_url,
            date: article.date,
            source_name: article.sources?.source_name || "Unknown",
            counties: article.article_counties?.map((ac: any) => ac.counties?.name).filter(Boolean) || [],
            tags: article.article_tags?.map((at: any) => at.tag).filter(Boolean) || [],
        }));

        // Apply LLM-powered search
        const searchResults = await searchArticlesWithGemini(transformedArticles, query);

        return NextResponse.json({
            articles: searchResults,
            totalFound: searchResults.length,
            query: query,
            dateRange: dateRange,
        });
    } catch (error) {
        console.error("Error in news search API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
