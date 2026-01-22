# Email Sync Lambda Function

This Lambda function processes email sync jobs from an SQS queue, moving the long-running sync process off Vercel's API routes to avoid timeout issues.

## Architecture

```
Vercel API Route → SQS Queue → Lambda Function → Supabase/Nylas/Gemini
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure AWS Credentials

Set up AWS credentials using one of these methods:

```bash
# Option 1: AWS CLI
aws configure

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
```

### 3. Set Environment Variables

Create a `.env` file or set these in your deployment environment:

```bash
# Nylas Configuration
NYLAS_API_KEY=your-nylas-api-key
NYLAS_CLIENT_ID=your-nylas-client-id
NYLAS_API_URI=https://api.us.nylas.com  # Optional
NYLAS_EMAIL_SYNC_LIMIT=600  # Optional
NYLAS_CALENDAR_SYNC_LIMIT=600  # Optional

# Gemini API (for email filtering)
GEMINI_API_KEY=your-gemini-api-key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AWS Configuration
AWS_REGION=us-east-1  # Optional, defaults to us-east-1
```

### 4. Deploy

```bash
# Deploy to AWS
npm run sls:deploy

# Deploy to specific stage/region
serverless deploy --stage production --region us-west-2
```

After deployment, you'll get:
- SQS Queue URL (save this for your Vercel environment variables)
- Lambda function ARN
- Dead Letter Queue URL

### 5. Configure Vercel Environment Variables

Add these to your Vercel project settings:

```bash
EMAIL_SYNC_QUEUE_URL=<queue-url-from-deployment-output>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
```

**Note:** For production, use Vercel's environment variable UI or CLI rather than hardcoding credentials.

## Usage

The API route (`/api/integrations/sync`) now automatically enqueues jobs to SQS instead of processing synchronously. The Lambda function processes them asynchronously.

## Monitoring

### View Logs

```bash
# Stream logs
npm run sls:logs

# View logs in AWS Console
# Go to CloudWatch → Log Groups → /aws/lambda/email-sync-processor-dev-syncEmailContacts
```

### Check Queue Status

```bash
# Using AWS CLI
aws sqs get-queue-attributes \
  --queue-url <your-queue-url> \
  --attribute-names All
```

### Dead Letter Queue

Failed jobs (after 3 retries) will be sent to the DLQ. Monitor this queue for persistent failures.

## Troubleshooting

### Lambda Timeout

If syncs are timing out:
1. Increase `timeout` in `serverless.yml` (max 900 seconds)
2. Consider breaking sync into smaller batches
3. Check CloudWatch logs for bottlenecks

### SQS Visibility Timeout

The queue's visibility timeout (900s) must be >= Lambda timeout. If Lambda times out, the message becomes visible again for retry.

### Missing Environment Variables

Ensure all required environment variables are set in both:
- Serverless deployment (for Lambda)
- Vercel project settings (for API route)

## Cost Estimation

- **Lambda:** ~$0.20 per 1M requests + compute time
- **SQS:** ~$0.40 per 1M requests
- **CloudWatch Logs:** ~$0.50 per GB ingested

For 1,000 syncs/month: ~$0.01-0.05/month

## Cleanup

```bash
# Remove all AWS resources
npm run sls:remove
```
