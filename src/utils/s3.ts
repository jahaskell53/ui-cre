import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || "us-east-1";

export const s3Client = new S3Client({
    region,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY || "",
        secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
    },
});

export const BUCKET_NAME = process.env.AWS_S3_BUCKET || "untitledui-profile-pics";
export const S3_REGION = region;

