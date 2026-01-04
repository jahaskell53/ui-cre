import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.ACCESS_KEY || "",
        secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
    },
});

export const BUCKET_NAME = process.env.AWS_S3_BUCKET || "untitledui-profile-pics";
