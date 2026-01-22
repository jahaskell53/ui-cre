import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  checkArticleRelevance,
  getCountyCategories,
  getCityCategories,
  getArticleTags,
} from "@/lib/news/categorization";
import { getCountyIds } from "@/lib/news/counties";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute timeout for long-running categorization

interface Article {
  id: string;
  title: string;
  description: string | null;
  link: string;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const timings: Record<string, number> = {};

  try {
    console.log("CRON JOB STARTED - Article Categorization");
    console.log("Timestamp:", new Date().toISOString());

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("UNAUTHORIZED: Invalid or missing auth header");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    console.log("Authentication successful");

    const supabase = await createClient();

    // Fetch uncategorized articles (limit to batch size to avoid timeout)
    const BATCH_SIZE = 50;
    const { data: articles, error: fetchError } = await supabase
      .from("articles")
      .select("id, title, description, link")
      .eq("is_categorized", false)
      .eq("is_relevant", true) // Only categorize relevant articles
      .order("date", { ascending: false })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching uncategorized articles:", fetchError);
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    }

    if (!articles || articles.length === 0) {
      console.log("No uncategorized articles found");
      return NextResponse.json({
        ok: true,
        message: "No uncategorized articles to process",
        results: { processed: 0 },
      });
    }

    console.log(`Found ${articles.length} uncategorized articles to process`);

    // Step 1: Check relevance for articles that haven't been checked yet
    const relevanceStartTime = Date.now();
    console.log("Checking article relevance...");

    const articleInputs = articles.map((a: Article) => ({
      title: a.title,
      description: a.description || undefined,
    }));

    const relevanceResults = await checkArticleRelevance(articleInputs);
    timings.relevance = Date.now() - relevanceStartTime;
    console.log(`Relevance check completed in ${timings.relevance}ms`);

    // Filter out irrelevant articles
    const relevantArticles = articles.filter((_: Article, i: number) => relevanceResults[i]);
    const irrelevantArticles = articles.filter((_: Article, i: number) => !relevanceResults[i]);

    console.log(`${relevantArticles.length} relevant, ${irrelevantArticles.length} irrelevant`);

    // Mark irrelevant articles
    if (irrelevantArticles.length > 0) {
      const irrelevantIds = irrelevantArticles.map((a: Article) => a.id);
      await supabase
        .from("articles")
        .update({ is_relevant: false, is_categorized: true })
        .in("id", irrelevantIds);
      console.log(`Marked ${irrelevantArticles.length} articles as irrelevant`);
    }

    if (relevantArticles.length === 0) {
      console.log("No relevant articles to categorize");
      return NextResponse.json({
        ok: true,
        results: {
          processed: articles.length,
          relevant: 0,
          irrelevant: irrelevantArticles.length,
        },
        timings,
      });
    }

    // Step 2: Get county categories
    const countyStartTime = Date.now();
    console.log("Categorizing by county...");

    const countyInputs = relevantArticles.map((a: Article) => ({
      title: a.title,
      description: a.description || undefined,
    }));

    const countyResults = await getCountyCategories(countyInputs);
    timings.counties = Date.now() - countyStartTime;
    console.log(`County categorization completed in ${timings.counties}ms`);

    // Step 3: Get city categories
    const cityStartTime = Date.now();
    console.log("Categorizing by city...");

    const cityInputs = relevantArticles.map((a: Article, i: number) => ({
      title: a.title,
      description: a.description || undefined,
      currentCounties: countyResults[i],
    }));

    const cityResults = await getCityCategories(cityInputs);
    timings.cities = Date.now() - cityStartTime;
    console.log(`City categorization completed in ${timings.cities}ms`);

    // Step 4: Get article tags
    const tagStartTime = Date.now();
    console.log("Tagging articles...");

    const tagInputs = relevantArticles.map((a: Article) => ({
      title: a.title,
      description: a.description || undefined,
    }));

    const tagResults = await getArticleTags(tagInputs);
    timings.tags = Date.now() - tagStartTime;
    console.log(`Tagging completed in ${timings.tags}ms`);

    // Step 5: Save categorization results to database
    const saveStartTime = Date.now();
    console.log("Saving categorization results...");

    let savedCount = 0;
    for (let i = 0; i < relevantArticles.length; i++) {
      const article = relevantArticles[i];
      const counties = countyResults[i] || ["Other"];
      const cities = cityResults[i] || [];
      const tags = tagResults[i] || [];

      try {
        // Get county IDs
        const countyIds = await getCountyIds(counties);

        // Insert county links
        if (countyIds.length > 0) {
          const countyLinks = countyIds.map((countyId) => ({
            article_id: article.id,
            county_id: countyId,
          }));

          await supabase
            .from("article_counties")
            .upsert(countyLinks, { onConflict: "article_id,county_id", ignoreDuplicates: true });
        }

        // Insert city links
        if (cities.length > 0) {
          const cityLinks = cities.map((city: string) => ({
            article_id: article.id,
            city: city,
          }));

          await supabase
            .from("article_cities")
            .upsert(cityLinks, { onConflict: "article_id,city", ignoreDuplicates: true });
        }

        // Insert tag links
        if (tags.length > 0) {
          const tagLinks = tags.map((tag: string) => ({
            article_id: article.id,
            tag: tag,
          }));

          await supabase
            .from("article_tags")
            .upsert(tagLinks, { onConflict: "article_id,tag", ignoreDuplicates: true });
        }

        // Mark article as categorized
        await supabase
          .from("articles")
          .update({ is_categorized: true })
          .eq("id", article.id);

        savedCount++;
      } catch (error) {
        console.error(`Error saving categorization for article ${article.id}:`, error);
      }
    }

    timings.save = Date.now() - saveStartTime;
    console.log(`Saved ${savedCount} article categorizations in ${timings.save}ms`);

    const totalTime = Date.now() - startTime;
    timings.total = totalTime;

    console.log("CRON JOB COMPLETED SUCCESSFULLY");
    console.log("TIMING BREAKDOWN:");
    console.log(`   Relevance: ${timings.relevance}ms`);
    console.log(`   Counties: ${timings.counties}ms`);
    console.log(`   Cities: ${timings.cities}ms`);
    console.log(`   Tags: ${timings.tags}ms`);
    console.log(`   Save: ${timings.save}ms`);
    console.log(`   Total: ${timings.total}ms`);

    return NextResponse.json({
      ok: true,
      results: {
        processed: articles.length,
        relevant: relevantArticles.length,
        irrelevant: irrelevantArticles.length,
        categorized: savedCount,
      },
      timings,
    });
  } catch (error) {
    console.error("Error in categorization job:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
