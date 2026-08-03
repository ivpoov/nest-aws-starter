import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

interface NoteBodyInterface {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

describe('notes', () => {
  let app: NestFastifyApplication;
  let ownerToken: string;
  let strangerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await registerUser();
    strangerToken = await registerUser();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({
        displayName: 'Note E2E',
        email: `note-e2e-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(201);

    return response.body.accessToken;
  }

  async function createNote(title: string, token: string = ownerToken): Promise<NoteBodyInterface> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/notes')
      .set('authorization', `Bearer ${token}`)
      .set('x-forwarded-for', uniqueIp())
      .send({ title })
      .expect(201);

    return response.body as NoteBodyInterface;
  }

  it('rejects every route without a token', async () => {
    await request(app.getHttpServer()).post('/api/v1/notes').send({ title: 'nope' }).expect(401);
    await request(app.getHttpServer()).get('/api/v1/notes').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/notes/01890a5d-ac96-774b-bcce-b30209000000')
      .expect(401);
  });

  it('creates a note and serializes only exposed fields', async () => {
    const note: NoteBodyInterface = await createNote('First e2e note');

    expect(note.title).toBe('First e2e note');
    expect(note.body).toBe('');
    expect(note.status).toBe('ACTIVE');
    expect(Object.keys(note).sort()).toEqual([
      'body',
      'createdAt',
      'id',
      'status',
      'title',
      'updatedAt',
    ]);
  });

  it('rejects an over-long title with the coded envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/notes')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-forwarded-for', uniqueIp())
      .send({ title: 'x'.repeat(300) })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(typeof response.body.code).toBe('string');
    expect(response.body.details).toContain('title');
  });

  it('hides foreign notes from reads, updates and deletes with 403', async () => {
    const note: NoteBodyInterface = await createNote('private note');

    const read = await request(app.getHttpServer())
      .get(`/api/v1/notes/${note.id}`)
      .set('authorization', `Bearer ${strangerToken}`)
      .expect(403);

    expect(read.body.code).toBe('NOTE_ACCESS_DENIED');

    await request(app.getHttpServer())
      .patch(`/api/v1/notes/${note.id}`)
      .set('authorization', `Bearer ${strangerToken}`)
      .send({ title: 'hijack' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/notes/${note.id}`)
      .set('authorization', `Bearer ${strangerToken}`)
      .expect(403);

    const untouched = await request(app.getHttpServer())
      .get(`/api/v1/notes/${note.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(untouched.body.title).toBe('private note');
  });

  it('scopes the list to the requesting user', async () => {
    const own: NoteBodyInterface = await createNote('mine in list');
    const foreign: NoteBodyInterface = await createNote('theirs in list', strangerToken);

    const seen: Set<string> = new Set();
    let cursor: string | null = null;

    for (let page = 0; page < 50; page += 1) {
      const query: string = cursor ? `?limit=2&cursor=${cursor}` : '?limit=2';
      const response = await request(app.getHttpServer())
        .get(`/api/v1/notes${query}`)
        .set('authorization', `Bearer ${ownerToken}`)
        .expect(200);

      for (const item of response.body.items as NoteBodyInterface[]) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }

      cursor = response.body.nextCursor;

      if (cursor === null) break;
    }

    expect(seen.has(own.id)).toBe(true);
    expect(seen.has(foreign.id)).toBe(false);
  });

  it('returns the coded not-found envelope for a missing id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/notes/01890a5d-ac96-774b-bcce-b30209000000')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(404);

    expect(response.body.code).toBe('NOTE_NOT_FOUND');
  });

  it('updates a note', async () => {
    const note: NoteBodyInterface = await createNote('to-update');

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/notes/${note.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ title: 'updated title', status: 'ARCHIVED' })
      .expect(200);

    expect(response.body.title).toBe('updated title');
    expect(response.body.status).toBe('ARCHIVED');
  });

  it('deletes a note and then returns 404 for it', async () => {
    const note: NoteBodyInterface = await createNote('to-delete');

    await request(app.getHttpServer())
      .delete(`/api/v1/notes/${note.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(204);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/notes/${note.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(404);

    expect(response.body.code).toBe('NOTE_NOT_FOUND');
  });
});
