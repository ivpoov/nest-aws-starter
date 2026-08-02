import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { S3_PROVIDER } from '@providers/s3/constants/s3.constants.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

async function ensureBucket(): Promise<void> {
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

describe('S3 provider (MinIO)', () => {
  let app: NestFastifyApplication;
  let s3: S3ProviderInterface;

  beforeAll(async () => {
    await ensureBucket();
    app = await createTestApp();
    s3 = app.get<S3ProviderInterface>(S3_PROVIDER);
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploads a buffer, presigns and serves it back', async () => {
    const body: Buffer = Buffer.from('hello from the starter');

    const key: string = await s3.upload({
      key: 'e2e/hello.txt',
      body,
      contentType: 'text/plain',
    });

    expect(key).toBe('e2e/hello.txt');

    const url: string = await s3.getPresignedUrl(key, 60);
    const response: Response = await fetch(url);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('hello from the starter');
  });

  it('deletes an object so the presigned url stops serving it', async () => {
    const key: string = await s3.upload({
      key: 'e2e/to-delete.txt',
      body: Buffer.from('bye'),
      contentType: 'text/plain',
    });

    await s3.delete(key);

    const url: string = await s3.getPresignedUrl(key, 60);
    const response: Response = await fetch(url);

    expect(response.status).toBe(404);
  });
});
