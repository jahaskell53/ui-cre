import { GoogleGenAI, GenerateContentParameters } from '@google/genai';
import { getLangfuseClient } from '../../../instrumentation';

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
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

// Helper function to create Gemini API call with Langfuse tracing
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

  // Create Langfuse generation span for tracing
  const langfuse = getLangfuseClient();
  const modelParameters: Record<string, string | number | boolean> = {};
  if (options.temperature !== undefined) modelParameters.temperature = options.temperature;
  if (options.maxTokens !== undefined) modelParameters.maxOutputTokens = options.maxTokens;
  if (options.responseMimeType !== undefined) modelParameters.responseMimeType = options.responseMimeType;

  // Ensure input is properly formatted for Langfuse
  // Langfuse expects input/output to be serializable (string, object, or array)
  // Make sure prompt is a non-empty string
  const inputForLangfuse = prompt && prompt.trim() ? prompt.trim() : '';

  const generation = langfuse?.generation({
    name: options.operation,
    input: inputForLangfuse,
    model: model,
    modelParameters: Object.keys(modelParameters).length > 0 ? modelParameters : undefined,
    traceId: options.traceId,
    metadata: {
      ...options.properties,
    },
  });

  try {
    const response = await client.models.generateContent(params);
    const latency = Date.now() - startTime;

    // Extract response text and token usage
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = response.usageMetadata;

    // Ensure output is properly formatted for Langfuse
    // Langfuse expects input/output to be serializable (string, object, or array)
    // Make sure responseText is a non-empty string
    const outputForLangfuse = responseText && responseText.trim() ? responseText.trim() : '';

    // Update Langfuse generation with output and usage
    // Make sure to pass output as a proper value, not undefined or null
    if (generation) {
      generation.update({
        output: outputForLangfuse,
        usage: usage ? {
          input: usage.promptTokenCount || 0,
          output: usage.candidatesTokenCount || 0,
          total: usage.totalTokenCount || 0,
        } : undefined,
      });
      generation.end();
    }

    // Log operation for debugging
    console.log(`[Gemini] ${options.operation} completed in ${latency}ms`);

    return response as GeminiResponse;
  } catch (error) {
    const latency = Date.now() - startTime;

    // Update Langfuse generation with error
    generation?.update({
      output: error instanceof Error ? error.message : 'Unknown error',
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    generation?.end();

    console.error(`[Gemini] ${options.operation} failed after ${latency}ms:`, error);
    throw error;
  }
}
