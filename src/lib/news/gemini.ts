import { GoogleGenAI, GenerateContentParameters } from '@google/genai';

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

// Initialize Gemini client (singleton)
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }

    geminiClient = new GoogleGenAI({
      apiKey: geminiApiKey
    });
  }
  return geminiClient;
}

// Helper function to create Gemini API call
export async function makeGeminiCall(
  model: string,
  prompt: string,
  options: {
    operation: string;
    maxTokens?: number;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: object;
    traceId?: string;
    properties?: Record<string, unknown>;
  }
): Promise<GeminiResponse> {
  const client = getGeminiClient();
  const startTime = Date.now();

  // Build the request parameters
  const params: GenerateContentParameters = {
    model: model,
    contents: [prompt],
    config: {
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature,
      ...(options.responseMimeType && { responseMimeType: options.responseMimeType }),
      ...(options.responseSchema && { responseSchema: options.responseSchema })
    }
  };

  try {
    const response = await client.models.generateContent(params);
    const latency = Date.now() - startTime;

    // Log operation for debugging
    console.log(`[Gemini] ${options.operation} completed in ${latency}ms`);

    return response as GeminiResponse;
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`[Gemini] ${options.operation} failed after ${latency}ms:`, error);
    throw error;
  }
}
