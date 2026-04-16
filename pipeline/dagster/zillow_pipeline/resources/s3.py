import boto3
from dagster import ConfigurableResource


class S3Resource(ConfigurableResource):
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    bucket_name: str

    def get_client(self):
        return boto3.client(
            "s3",
            region_name=self.aws_region,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
        )

    def upload_bytes(self, key: str, data: bytes, content_type: str = "application/pdf") -> str:
        """Upload bytes to S3 and return the public URL."""
        client = self.get_client()
        client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return f"https://{self.bucket_name}.s3.{self.aws_region}.amazonaws.com/{key}"
