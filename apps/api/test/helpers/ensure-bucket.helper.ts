import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';

export async function ensureBucket(): Promise<void> {
  const client: S3Client = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9010',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    },
  });

  try {
    await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET_NAME ?? 'starter' }));
  } catch (caught) {
    const name: string = (caught as Error).name;

    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') throw caught;
  } finally {
    client.destroy();
  }
}
