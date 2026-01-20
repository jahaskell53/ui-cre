# AWS Lambda + SQS Setup for Email Sync

This setup migrates the email-to-contact processing from Vercel API routes (which have timeout limits) to AWS Lambda functions triggered by SQS queues.

## What Was Set Up

1. **Serverless Framework Configuration** (`serverless.yml`)
   - Lambda function with 15-minute timeout
   - SQS queue with dead-letter queue
   - Proper IAM permissions

2. **Lambda Handler** (`lambda/sync-email-contacts.ts`)
   - Processes sync jobs from SQS
   - Handles errors and retries
   - Uses your existing `syncAllContacts` function

3. **SQS Utility** (`src/utils/sqs.ts`)
   - Helper function to enqueue sync jobs

4. **Updated API Route** (`src/app/api/integrations/sync/route.ts`)
   - Now enqueues jobs to SQS instead of processing synchronously
   - Returns immediately (no timeout issues)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure AWS Credentials

```bash
# Install AWS CLI if not already installed
# https://aws.amazon.com/cli/

aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1 (or your preferred region)
# Default output format: json
```

### 3. Set Environment Variables

Create a `.env` file or export these variables:

```bash
# Nylas
export NYLAS_API_KEY=your-key
export NYLAS_CLIENT_ID=your-client-id

# Google AI (for email filtering)
export GOOGLE_AI_API_KEY=your-key

# Supabase
export NEXT_PUBLIC_SUPABASE_URL=your-url
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AWS (optional, defaults to us-east-1)
export AWS_REGION=us-east-1
```

### 4. Deploy to AWS

```bash
npm run sls:deploy
```

After deployment, note the **EmailSyncQueueUrl** from the output.

### 5. Configure Vercel

Add these environment variables to your Vercel project:

```bash
EMAIL_SYNC_QUEUE_URL=<queue-url-from-deployment>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
```

**Important:** For production, use Vercel's environment variable UI (Settings → Environment Variables) rather than hardcoding credentials.

### 6. Test

The `/api/integrations/sync` endpoint now works asynchronously:
- Returns immediately with `{ success: true, message: 'Sync job queued for processing' }`
- Lambda processes the sync in the background
- Check sync status via the GET endpoint

## Monitoring

### View Lambda Logs

```bash
npm run sls:logs
```

Or in AWS Console: CloudWatch → Log Groups → `/aws/lambda/email-sync-processor-dev-syncEmailContacts`

### Check Queue Status

```bash
aws sqs get-queue-attributes \
  --queue-url <your-queue-url> \
  --attribute-names All
```

### Dead Letter Queue

Failed jobs (after 3 retries) go to the DLQ. Monitor this for persistent failures.

## Troubleshooting

### "EMAIL_SYNC_QUEUE_URL environment variable is not set"

Make sure you've added `EMAIL_SYNC_QUEUE_URL` to your Vercel environment variables.

### Lambda Timeout

If syncs are timing out:
1. Check CloudWatch logs for bottlenecks
2. Consider reducing `NYLAS_EMAIL_SYNC_LIMIT` in environment variables
3. Lambda timeout is already set to max (900 seconds)

### Import Errors in Lambda

The esbuild plugin should handle all imports automatically. If you see import errors:
1. Check that all dependencies are in `package.json`
2. Verify path aliases are correct in `serverless.yml`

## Cost

- **Lambda:** ~$0.20 per 1M requests + compute time (~$0.0000166667 per GB-second)
- **SQS:** ~$0.40 per 1M requests
- **CloudWatch Logs:** ~$0.50 per GB ingested

For 1,000 syncs/month: approximately **$0.01-0.05/month**

## Cleanup

To remove all AWS resources:

```bash
npm run sls:remove
```

## Architecture Flow

```
User Request → Vercel API Route → SQS Queue → Lambda Function
                                                      ↓
                                              Supabase/Nylas/Gemini
```

Benefits:
- ✅ No Vercel timeout limits
- ✅ Automatic retries via SQS
- ✅ Dead letter queue for failed jobs
- ✅ Scalable and cost-effective
- ✅ Better error handling and monitoring
