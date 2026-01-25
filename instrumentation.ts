import { Langfuse } from 'langfuse';

// Simple Langfuse client for tracing Gemini calls
let langfuseClient: Langfuse | null = null;

export function getLangfuseClient(): Langfuse | null {
  if (!langfuseClient) {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;

    if (publicKey && secretKey) {
      langfuseClient = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      });
      console.log('Langfuse client initialized for Gemini tracing');
    }
  }
  return langfuseClient;
}

/**
 * Flush Langfuse events - must be called before Lambda terminates
 * to ensure all traces are sent
 */
export async function flushLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.flushAsync();
  }
}

// Next.js calls this function when the app starts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    getLangfuseClient();
  }
}
