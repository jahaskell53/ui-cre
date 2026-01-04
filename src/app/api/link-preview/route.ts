import { NextRequest, NextResponse } from "next/server";
import { getLinkPreview } from "link-preview-js";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const preview = await getLinkPreview(url, {
      timeout: 5000,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Type guard to check if preview has the expected properties
    const hasTitle = "title" in preview;
    const hasImages = "images" in preview;

    return NextResponse.json({
      title: hasTitle ? (preview.title || "") : "",
      description: hasTitle ? (preview.description || "") : "",
      image: hasImages && Array.isArray(preview.images) ? (preview.images[0] || "") : "",
      siteName: hasTitle ? (preview.siteName || "") : "",
      url: preview.url || url,
    });
  } catch (error) {
    console.error("Error fetching link preview:", error);
    return NextResponse.json(
      { error: "Failed to fetch link preview" },
      { status: 500 }
    );
  }
}

