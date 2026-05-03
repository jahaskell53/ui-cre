import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || "us-east-1";

export const s3Client = new S3Client({ region });

export const BUCKET_NAME = process.env.AWS_S3_BUCKET || "";
export const S3_REGION = region;
