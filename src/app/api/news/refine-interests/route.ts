import { NextRequest, NextResponse } from "next/server";
import { makeGeminiCall } from "@/lib/news/gemini";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, interests, conversation, preferences } = body;

    if (!action || !interests) {
      return NextResponse.json(
        { error: "Missing required fields: action and interests" },
        { status: 400 }
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (action === "ask-questions") {
      const prompt = `You are a helpful assistant helping someone set up their commercial real estate newsletter preferences.

The user has expressed interest in: ${interests}

Generate 3-5 clarifying questions to better understand their specific interests. These questions should help refine what types of commercial real estate news they want to receive.

Return a JSON object with a "questions" array containing the questions.

Example:
{
  "questions": [
    "What property types are you most interested in? (e.g., office, retail, industrial, multifamily)",
    "Are you more interested in investment opportunities, market trends, or development news?",
    "What geographic markets are you focused on?"
  ]
}`;

      const response = await makeGeminiCall("gemini-3-flash-preview", prompt, {
        operation: "refine-interests-questions",
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            questions: {
              type: "ARRAY",
              items: {
                type: "STRING"
              }
            }
          },
          required: ["questions"]
        },
        properties: {
          interests,
        }
      });

      const result = JSON.parse(response.candidates[0].content.parts[0].text);

      return NextResponse.json({
        success: true,
        questions: result.questions
      });

    } else if (action === "enhance-description") {
      if (!conversation || !Array.isArray(conversation)) {
        return NextResponse.json(
          { error: "Missing or invalid conversation array" },
          { status: 400 }
        );
      }

      const conversationText = conversation
        .map((turn: { question: string; answer: string }) => 
          `Q: ${turn.question}\nA: ${turn.answer}`
        )
        .join("\n\n");

      const prompt = `You are a helpful assistant helping someone set up their commercial real estate newsletter preferences.

Initial interests: ${interests}

Conversation:
${conversationText}

Based on the conversation, generate 3-5 refined preference statements that clearly describe what commercial real estate news the user wants to receive. Each statement should be specific and actionable.

Return a JSON object with a "preferences" array containing the preference statements.

Example:
{
  "preferences": [
    "Multifamily apartment development and investment opportunities in the San Francisco Bay Area",
    "Office space market trends and leasing activity in downtown San Francisco",
    "Retail property investment opportunities in high-traffic areas"
  ]
}`;

      const response = await makeGeminiCall("gemini-3-flash-preview", prompt, {
        operation: "refine-interests-enhance",
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            preferences: {
              type: "ARRAY",
              items: {
                type: "STRING"
              }
            }
          },
          required: ["preferences"]
        },
        properties: {
          interests,
          conversationLength: conversation.length,
        }
      });

      const result = JSON.parse(response.candidates[0].content.parts[0].text);

      return NextResponse.json({
        success: true,
        preferences: result.preferences
      });

    } else if (action === "determine-counties") {
      if (!conversation || !Array.isArray(conversation)) {
        return NextResponse.json(
          { error: "Missing or invalid conversation array" },
          { status: 400 }
        );
      }

      if (!preferences || !Array.isArray(preferences)) {
        return NextResponse.json(
          { error: "Missing or invalid preferences array" },
          { status: 400 }
        );
      }

      const supabase = await createClient();
      
      // Fetch all available counties from database
      const { data: counties, error: countiesError } = await supabase
        .from("counties")
        .select("name")
        .order("name", { ascending: true });

      if (countiesError) {
        console.error("Error fetching counties:", countiesError);
        return NextResponse.json(
          { error: "Failed to fetch counties" },
          { status: 500 }
        );
      }

      const availableCounties = counties.map(c => c.name).filter(name => name !== 'Other').join(", ");

      const conversationText = conversation
        .map((turn: { question: string; answer: string }) => 
          `Q: ${turn.question}\nA: ${turn.answer}`
        )
        .join("\n\n");

      const preferencesText = preferences.join("\n• ");

      const prompt = `You are a helpful assistant helping someone set up their commercial real estate newsletter preferences.

Initial interests: ${interests}

Conversation:
${conversationText}

Refined preferences:
• ${preferencesText}

Available counties: ${availableCounties}

Based on the conversation and preferences, determine which counties are most relevant. Return a JSON object with a "counties" array containing county names (exact matches from the available counties list).

Return a JSON object with a "counties" array containing the relevant county names.

Example:
{
  "counties": ["San Francisco County", "San Mateo County", "Santa Clara County"]
}`;

      const response = await makeGeminiCall("gemini-3-flash-preview", prompt, {
        operation: "refine-interests-determine-counties",
        temperature: 1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            counties: {
              type: "ARRAY",
              items: {
                type: "STRING"
              }
            }
          },
          required: ["counties"]
        },
        properties: {
          interests,
          conversationLength: conversation.length,
          preferencesCount: preferences.length,
        }
      });

      const result = JSON.parse(response.candidates[0].content.parts[0].text);

      return NextResponse.json({
        success: true,
        counties: result.counties
      });

    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be 'ask-questions', 'enhance-description', or 'determine-counties'" },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Error in refine-interests API:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
