import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const QUEUE_URL = process.env.EMAIL_SYNC_QUEUE_URL;

export interface SyncJobMessage {
  grantId: string;
  userId: string;
  mockMode?: boolean;
}

/**
 * Check if mock mode is enabled via environment variable
 */
function isMockModeEnabled(): boolean {
  return process.env.MOCK_NYLAS_API === 'true';
}

/**
 * Send an email sync job to the SQS queue for async processing
 * If MOCK_NYLAS_API=true in the app's environment, the Lambda will use mock data
 */
export async function enqueueEmailSync(grantId: string, userId: string): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error('EMAIL_SYNC_QUEUE_URL environment variable is not set');
  }

  const mockMode = isMockModeEnabled();

  const message: SyncJobMessage = {
    grantId,
    userId,
    ...(mockMode && { mockMode: true }),
  };

  if (mockMode) {
    console.log('[SQS] Enqueueing sync job with MOCK MODE enabled');
  }

  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(message),
  });

  try {
    const response = await sqsClient.send(command);
    console.log('Sync job enqueued:', response.MessageId);
  } catch (error) {
    console.error('Error enqueuing sync job:', error);
    throw error;
  }
}
