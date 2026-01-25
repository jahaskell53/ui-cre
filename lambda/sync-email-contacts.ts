import { SQSEvent, SQSHandler, SQSBatchResponse, Context } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
// Use relative import - esbuild will bundle dependencies
import { syncAllContacts, type SyncResult } from '../src/lib/nylas/sync';
import { flushLangfuse } from '../instrumentation';

const sqsClient = new SQSClient({});

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
      const { grantId, userId, retryCount = 0 } = body;

      if (!grantId || !userId) {
        console.error('Missing grantId or userId in message:', body);
        // Don't add to failures - this is a bad message that shouldn't be retried
        continue;
      }

      console.log(`Processing sync for grantId: ${grantId}, userId: ${userId}, retryCount: ${retryCount}`);

      // Process the sync
      const result: SyncResult = await syncAllContacts(grantId, userId);

      if (result.rateLimited) {
        // Rate limited - schedule a delayed retry instead of immediate SQS retry
        await scheduleDelayedRetry(
          grantId,
          userId,
          retryCount + 1,
          result.retryAfterMs || 60000
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
    } catch (error) {
      console.error('Error processing sync job:', error);

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
  delayMs: number
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
      }),
      DelaySeconds: delaySeconds,
    }));

    console.log(`Scheduled retry ${retryCount}/${MAX_RETRIES} with ${delaySeconds}s delay`);
  } catch (error) {
    console.error('Error scheduling delayed retry:', error);
  }
}
