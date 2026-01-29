import { SQSEvent, SQSHandler, SQSBatchResponse, Context } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
// Use relative import - esbuild will bundle dependencies
import { syncAllContacts, type SyncResult } from '../src/lib/nylas/sync';
import { flushLangfuse } from '../instrumentation';

const sqsClient = new SQSClient({});

// Handle unhandled promise rejections to prevent Lambda crashes
// These can occur when Nylas SDK creates promises that reject after we've moved on
// The Nylas SDK's async iterator creates internal promises that may reject asynchronously
// even after we've caught the main error and moved on
// 
// IMPORTANT: This handler must be registered at module load time, before any async operations
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const errorInfo = {
    message: reason?.message || String(reason),
    errorType: reason?.errorType,
    statusCode: reason?.statusCode,
    type: reason?.type,
    name: reason?.name,
  };
  
  console.error('[UNHANDLED REJECTION HANDLER] Caught unhandled promise rejection:', JSON.stringify(errorInfo, null, 2));
  
  // For Nylas SDK errors (429 rate limits, 404 grant not found, etc.), these are expected
  // and will be handled by our retry logic or error handling in the Lambda handler.
  // We log them here for visibility but don't want them to crash the Lambda.
  
  // The key is that we've already logged the error, and the actual error handling
  // happens in collectPaginatedItems or the Lambda handler's try-catch.
  // By handling the unhandled rejection here, we prevent Lambda from seeing it as a fatal error.
  
  // Note: In Node.js, once a promise is unhandled, calling .catch() doesn't help.
  // However, by handling the unhandledRejection event, we're telling Node.js we've handled it.
  // Lambda will still log it, but it won't crash the function if we handle it properly.
});

/**
 * Lambda handler for processing email sync jobs from SQS
 *
 * Expected message format:
 * {
 *   grantId: string,
 *   userId: string,
 *   retryCount?: number  // Track retry attempts for rate limits
 * }
 *
 * Returns partial batch response to handle failures gracefully
 */
export const handler: SQSHandler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse | void> => {
  console.log(`Received ${event.Records.length} message(s) from SQS`);

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const { grantId, userId, retryCount = 0, mockMode = false } = body;

      if (!grantId || !userId) {
        console.error('Missing grantId or userId in message:', body);
        // Don't add to failures - this is a bad message that shouldn't be retried
        continue;
      }

      // Set mock mode based on message (allows app to control mock mode per-request)
      if (mockMode) {
        process.env.MOCK_NYLAS_API = 'true';
        console.log('[Lambda] Mock mode ENABLED for this sync job');
      } else {
        delete process.env.MOCK_NYLAS_API;
      }

      console.log(`Processing sync for grantId: ${grantId}, userId: ${userId}, retryCount: ${retryCount}, mockMode: ${mockMode}`);

      // Process the sync
      const result: SyncResult = await syncAllContacts(grantId, userId);

      if (result.rateLimited) {
        // Rate limited - schedule a delayed retry instead of immediate SQS retry
        await scheduleDelayedRetry(
          grantId,
          userId,
          retryCount + 1,
          result.retryAfterMs || 60000,
          mockMode
        );

        console.log(`Rate limited. Scheduled delayed retry in ${Math.round((result.retryAfterMs || 60000) / 1000)}s`, {
          grantId,
          userId,
          emailCount: result.emailCount,
          calendarCount: result.calendarCount,
          retryCount: retryCount + 1,
        });

        // Don't add to failures - we've handled it by scheduling a delayed retry
        // Message will be deleted from queue
      } else {
        console.log(`Sync completed successfully:`, {
          grantId,
          userId,
          emailCount: result.emailCount,
          calendarCount: result.calendarCount,
          isIncremental: result.isIncremental,
        });
      }

      // Message will be automatically deleted from queue on successful completion
    } catch (error: any) {
      console.error('Error processing sync job:', error);

      // Check if it's a non-retryable error (e.g., grant not found)
      const isGrantNotFound = error?.statusCode === 404 || 
                              error?.type === 'grant.not_found' ||
                              error?.message?.includes('No Grant found');
      
      if (isGrantNotFound) {
        console.error('Grant not found - this is a permanent error, not retrying:', {
          grantId: JSON.parse(record.body)?.grantId,
          error: error?.message,
        });
        // Don't add to failures - this message shouldn't be retried
        // The integration status has already been updated to 'error' in syncAllContacts
        continue;
      }

      // If we're close to timeout, mark as failed for retry
      const timeRemaining = context.getRemainingTimeInMillis();
      if (timeRemaining < 60000) {
        console.error('Approaching timeout, marking for retry');
        batchItemFailures.push({ itemIdentifier: record.messageId });
        continue;
      }

      // For other errors, mark as failed for SQS retry
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // Flush Langfuse traces before Lambda terminates
  await flushLangfuse();

  // Return batch response if there were any failures
  if (batchItemFailures.length > 0) {
    console.log(`Batch processing complete. ${batchItemFailures.length} failures to retry.`);
    return { batchItemFailures };
  }
};

/**
 * Schedule a delayed retry by sending a message with a delay
 * Uses SQS DelaySeconds to avoid hitting rate limits again immediately
 */
async function scheduleDelayedRetry(
  grantId: string,
  userId: string,
  retryCount: number,
  delayMs: number,
  mockMode: boolean = false
): Promise<void> {
  const queueUrl = process.env.SYNC_QUEUE_URL;

  if (!queueUrl) {
    console.error('SYNC_QUEUE_URL not configured. Cannot schedule delayed retry.');
    return;
  }

  // Max retry count to prevent infinite loops
  const MAX_RETRIES = 5;
  if (retryCount >= MAX_RETRIES) {
    console.error(`Max retries (${MAX_RETRIES}) reached for grantId: ${grantId}. Giving up.`);
    return;
  }

  // SQS max delay is 900 seconds (15 minutes)
  const delaySeconds = Math.min(Math.ceil(delayMs / 1000), 900);

  try {
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        grantId,
        userId,
        retryCount,
        ...(mockMode && { mockMode: true }),
      }),
      DelaySeconds: delaySeconds,
    }));

    console.log(`Scheduled retry ${retryCount}/${MAX_RETRIES} with ${delaySeconds}s delay${mockMode ? ' (mock mode)' : ''}`);
  } catch (error) {
    console.error('Error scheduling delayed retry:', error);
  }
}
