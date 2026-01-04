import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME } from "@/utils/s3";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
        const region = process.env.AWS_REGION || "us-east-1";

        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: `profile-pics/${fileName}`,
            Body: buffer,
            ContentType: file.type,
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const publicUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/profile-pics/${fileName}`;

        return NextResponse.json({ url: publicUrl });
    } catch (error: any) {
        console.error("S3 Upload Error:", error);
        return NextResponse.json({ error: error.message || "Failed to upload to S3" }, { status: 500 });
    }
}
