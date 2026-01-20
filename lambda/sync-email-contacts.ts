import { SQSEvent, SQSHandler, Context } from 'aws-lambda';
// Use relative import - esbuild will bundle dependencies
import { syncAllContacts } from '../src/lib/nylas/sync';

/**
 * Lambda handler for processing email sync jobs from SQS
 * 
 * Expected message format:
 * {
 *   grantId: string,
 *   userId: string
 * }
 */
export const handler: SQSHandler = async (event: SQSEvent, context: Context) => {
  console.log(`Received ${event.Records.length} message(s) from SQS`);

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const { grantId, userId } = body;

      if (!grantId || !userId) {
        console.error('Missing grantId or userId in message:', body);
        // Don't throw - let SQS retry mechanism handle it
        continue;
      }

      console.log(`Processing sync for grantId: ${grantId}, userId: ${userId}`);

      // Process the sync
      const result = await syncAllContacts(grantId, userId);

      console.log(`Sync completed successfully:`, {
        grantId,
        userId,
        emailCount: result.emailCount,
        calendarCount: result.calendarCount,
        isIncremental: result.isIncremental,
      });

      // Message will be automatically deleted from queue on successful completion
    } catch (error) {
      console.error('Error processing sync job:', error);
      
      // If we're close to timeout, don't retry
      const timeRemaining = context.getRemainingTimeInMillis();
      if (timeRemaining < 60000) { // Less than 1 minute remaining
        console.error('Approaching timeout, skipping retry');
        throw error; // This will send message to DLQ
      }

      // For other errors, throw to trigger SQS retry
      throw error;
    }
  }
};
