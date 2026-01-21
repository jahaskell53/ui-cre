import { NextRequest, NextResponse } from "next/server";
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

    // Get user's profile to check for newsletter preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscriber_id, newsletter_active")
      .eq("id", user.id)
      .single();

    // Build the query for articles
    // For now, return recent relevant articles
    // Later we can filter by user's county/city preferences via subscriber_id
    const { data: articles, error } = await supabase
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
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching articles:", error);
      return NextResponse.json(
        { error: "Failed to fetch articles" },
        { status: 500 }
      );
    }

    // Transform the data to flatten the nested structures
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

    return NextResponse.json(transformedArticles);
  } catch (error) {
    console.error("Error in news articles API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
