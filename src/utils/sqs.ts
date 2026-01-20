import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const QUEUE_URL = process.env.EMAIL_SYNC_QUEUE_URL;

export interface SyncJobMessage {
  grantId: string;
  userId: string;
}

/**
 * Send an email sync job to the SQS queue for async processing
 */
export async function enqueueEmailSync(grantId: string, userId: string): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error('EMAIL_SYNC_QUEUE_URL environment variable is not set');
  }

  const message: SyncJobMessage = {
    grantId,
    userId,
  };

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
