import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';
import { ensureBucket } from './helpers/ensure-bucket.helper.js';

describe('user profile', () => {
  let app: NestFastifyApplication;
  let accessToken: string;

  beforeAll(async () => {
    await ensureBucket();
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', `10.9.${Math.floor(Math.random() * 255)}.1`)
      .send({
        displayName: 'Profile E2E',
        email: `profile-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(201);

    accessToken = response.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires auth for the profile', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('returns the profile and updates the display name', async () => {
    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.displayName).toBe('Profile E2E');
    expect(me.body.avatarUrl).toBeNull();
    expect(me.body.avatarKey).toBeUndefined();

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'Renamed E2E' })
      .expect(200);

    expect(updated.body.displayName).toBe('Renamed E2E');
  });

  it('uploads an avatar through the presigned url and serves it back', async () => {
    const upload = await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar-upload')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ contentType: 'image/png' })
      .expect(201);

    expect(upload.body.key).toMatch(/^avatars\//);

    const pngBytes: Buffer = Buffer.from('89504e470d0a1a0a', 'hex');
    const putResponse: Response = await fetch(upload.body.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: pngBytes,
    });

    expect(putResponse.ok).toBe(true);

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.avatarUrl).toContain(upload.body.key);
  });

  it('rejects a non-image avatar content type', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar-upload')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ contentType: 'application/pdf' })
      .expect(400);

    expect(response.body.code).toBe('USER_AVATAR_TYPE_NOT_ALLOWED');
  });
});
