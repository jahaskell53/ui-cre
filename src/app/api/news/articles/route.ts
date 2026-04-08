import { desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { articleCounties, articleTags, articles, counties, sources } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
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

        const searchParams = request.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");

        // Fetch articles with source join
        const articleRows = await db
            .select({
                id: articles.id,
                title: articles.title,
                link: articles.link,
                description: articles.description,
                image_url: articles.imageUrl,
                date: articles.date,
                source_name: sources.sourceName,
            })
            .from(articles)
            .leftJoin(sources, eq(articles.sourceId, sources.sourceId))
            .where(eq(articles.isRelevant, true))
            .orderBy(desc(articles.date))
            .limit(limit)
            .offset(offset);

        if (articleRows.length === 0) {
            return NextResponse.json([]);
        }

        const articleIds = articleRows.map((a) => a.id);

        // Fetch counties for all articles
        const countyRows = await db
            .select({
                article_id: articleCounties.articleId,
                county_name: counties.name,
            })
            .from(articleCounties)
            .leftJoin(counties, eq(articleCounties.countyId, counties.id))
            .where(inArray(articleCounties.articleId, articleIds));

        // Fetch tags for all articles
        const tagRows = await db
            .select({
                article_id: articleTags.articleId,
                tag: articleTags.tag,
            })
            .from(articleTags)
            .where(inArray(articleTags.articleId, articleIds));

        // Build county/tag lookups
        const countyByArticle = new Map<string, string[]>();
        const tagByArticle = new Map<string, string[]>();

        for (const row of countyRows) {
            if (!countyByArticle.has(row.article_id)) countyByArticle.set(row.article_id, []);
            if (row.county_name) countyByArticle.get(row.article_id)!.push(row.county_name);
        }

        for (const row of tagRows) {
            if (!tagByArticle.has(row.article_id)) tagByArticle.set(row.article_id, []);
            if (row.tag) tagByArticle.get(row.article_id)!.push(row.tag);
        }

        const transformedArticles = articleRows.map((article) => ({
            id: article.id,
            title: article.title,
            link: article.link,
            description: article.description,
            image_url: article.image_url,
            date: article.date,
            source_name: article.source_name || "Unknown",
            counties: countyByArticle.get(article.id) || [],
            tags: tagByArticle.get(article.id) || [],
        }));

        return NextResponse.json(transformedArticles);
    } catch (error: any) {
        console.error("Error in GET /api/news/articles:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
