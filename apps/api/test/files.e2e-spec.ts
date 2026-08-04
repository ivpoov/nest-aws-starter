import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';
import { ensureBucket } from './helpers/ensure-bucket.helper.js';
import { waitForActivity } from './helpers/wait-for-activity.helper.js';

describe('files', () => {
  let app: NestFastifyApplication;
  let ownerToken: string;
  let strangerToken: string;
  let ownerId: string;

  beforeAll(async () => {
    await ensureBucket();
    app = await createTestApp();

    const owner = await registerUser();
    const stranger = await registerUser();

    ownerToken = owner.accessToken;
    ownerId = owner.userId;
    strangerToken = stranger.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<{ accessToken: string; userId: string }> {
    const email: string = `files-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Files E2E', email, password: 'correct-horse-battery' })
      .expect(201);

    const found = await app.get(PrismaService).authMethod.findFirst({ where: { email } });

    return { accessToken: response.body.accessToken, userId: found?.userId ?? '' };
  }

  async function requestUpload(
    body: { intent: string; contentType: string; size?: number },
    token: string = ownerToken,
  ): Promise<{ fileId: string; uploadUrl: string; key: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/upload-request')
      .set('authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    return response.body as { fileId: string; uploadUrl: string; key: string };
  }

  it('rejects every route without a token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/upload-request')
      .send({ intent: 'ATTACHMENT', contentType: 'text/plain' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/files/01890a5d-ac96-774b-bcce-b30209000000/confirm')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/files/01890a5d-ac96-774b-bcce-b30209000000/download-url')
      .expect(401);
  });

  it('runs the full upload → confirm → download flow', async () => {
    const bodyText = 'hello from the file module e2e';
    const upload = await requestUpload({
      intent: 'ATTACHMENT',
      contentType: 'text/plain',
      size: bodyText.length,
    });

    expect(upload.key).toMatch(new RegExp(`^files/${ownerId}/`));

    const putResponse: Response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: bodyText,
    });

    expect(putResponse.ok).toBe(true);

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/files/${upload.fileId}/confirm`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(confirmed.body.status).toBe('READY');
    expect(confirmed.body.size).toBe(bodyText.length);
    expect(confirmed.body.contentType).toBe('text/plain');

    const downloadUrl = await request(app.getHttpServer())
      .get(`/api/v1/files/${upload.fileId}/download-url`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(downloadUrl.body.downloadUrl).toContain(upload.key);

    const fetched: Response = await fetch(downloadUrl.body.downloadUrl);

    expect(fetched.ok).toBe(true);
    expect(await fetched.text()).toBe(bodyText);

    const activity = await waitForActivity(() =>
      app.get(PrismaService).activity.findFirst({
        where: { type: 'FILE_UPLOADED', userId: ownerId },
      }),
    );

    expect(activity).not.toBeNull();
    expect((activity?.meta as { fileId?: string } | null)?.fileId).toBe(upload.fileId);
  });

  it('rejects confirming an upload that was never put to s3', async () => {
    const upload = await requestUpload({ intent: 'ATTACHMENT', contentType: 'text/plain' });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/files/${upload.fileId}/confirm`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(409);

    expect(response.body.code).toBe('FILE_NOT_UPLOADED');
  });

  it('rejects confirming an object whose actual content type does not match the declared, allowed one', async () => {
    // Regression: @aws-sdk/s3-request-presigner puts Content-Type in
    // unsignableHeaders, so it is NOT part of the presigned PUT's signature —
    // a client can declare an allowed type at requestUpload and then PUT a
    // disallowed one. confirmUpload must re-validate what S3 actually stored.
    const upload = await requestUpload({ intent: 'AVATAR', contentType: 'image/png' });

    const putResponse: Response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/html' },
      body: '<script>alert(1)</script>',
    });

    expect(putResponse.ok).toBe(true);

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/files/${upload.fileId}/confirm`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(400);

    expect(confirmed.body.code).toBe('FILE_CONTENT_TYPE_NOT_ALLOWED');
  });

  it('hides a foreign file from confirm and download with 403', async () => {
    const upload = await requestUpload({ intent: 'ATTACHMENT', contentType: 'text/plain' });

    const putResponse: Response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: 'owned by someone else',
    });

    expect(putResponse.ok).toBe(true);

    const confirmForeign = await request(app.getHttpServer())
      .post(`/api/v1/files/${upload.fileId}/confirm`)
      .set('authorization', `Bearer ${strangerToken}`)
      .expect(403);

    expect(confirmForeign.body.code).toBe('FILE_ACCESS_DENIED');

    await request(app.getHttpServer())
      .post(`/api/v1/files/${upload.fileId}/confirm`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const downloadForeign = await request(app.getHttpServer())
      .get(`/api/v1/files/${upload.fileId}/download-url`)
      .set('authorization', `Bearer ${strangerToken}`)
      .expect(403);

    expect(downloadForeign.body.code).toBe('FILE_ACCESS_DENIED');
  });

  it('rejects a content type outside the intent allowlist', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/upload-request')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ intent: 'AVATAR', contentType: 'application/x-msdownload' })
      .expect(400);

    expect(response.body.code).toBe('FILE_CONTENT_TYPE_NOT_ALLOWED');
  });

  it('rejects a declared size over the intent cap', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/upload-request')
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ intent: 'ATTACHMENT', contentType: 'text/plain', size: 11 * 1024 * 1024 })
      .expect(400);

    expect(response.body.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects a download-url request before the upload is confirmed', async () => {
    const upload = await requestUpload({ intent: 'ATTACHMENT', contentType: 'text/plain' });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/files/${upload.fileId}/download-url`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(409);

    expect(response.body.code).toBe('FILE_NOT_READY');
  });

  it('returns the coded not-found envelope for a missing file id', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/01890a5d-ac96-774b-bcce-b30209000000/confirm')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(404);

    expect(response.body.code).toBe('FILE_NOT_FOUND');
  });
});
