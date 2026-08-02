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

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createNote(title: string): Promise<NoteBodyInterface> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/notes')
      .send({ title })
      .expect(201);

    return response.body as NoteBodyInterface;
  }

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
      .send({ title: 'x'.repeat(300) })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(typeof response.body.code).toBe('string');
    expect(response.body.details).toContain('title');
  });

  it('paginates by cursor without overlap or gaps', async () => {
    const created: NoteBodyInterface[] = [];

    for (const title of ['cursor-a', 'cursor-b', 'cursor-c']) {
      created.push(await createNote(title));
    }

    const seen: Map<string, number> = new Map();
    let cursor: string | null = null;

    for (let page = 0; page < 50; page += 1) {
      const query: string = cursor ? `?limit=2&cursor=${cursor}` : '?limit=2';
      const response = await request(app.getHttpServer()).get(`/api/v1/notes${query}`).expect(200);
      const items: NoteBodyInterface[] = response.body.items;

      for (const item of items) {
        seen.set(item.id, (seen.get(item.id) ?? 0) + 1);
      }

      cursor = response.body.nextCursor;

      if (cursor === null) break;
    }

    for (const note of created) {
      expect(seen.get(note.id)).toBe(1);
    }

    const duplicates: number = [...seen.values()].filter(
      (count: number): boolean => count > 1,
    ).length;

    expect(duplicates).toBe(0);
  });

  it('returns the coded not-found envelope for a missing id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/notes/01890a5d-ac96-774b-bcce-b30209000000')
      .expect(404);

    expect(response.body.code).toBe('NOTE_NOT_FOUND');
  });

  it('updates a note', async () => {
    const note: NoteBodyInterface = await createNote('to-update');

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/notes/${note.id}`)
      .send({ title: 'updated title', status: 'ARCHIVED' })
      .expect(200);

    expect(response.body.title).toBe('updated title');
    expect(response.body.status).toBe('ARCHIVED');
  });

  it('deletes a note and then returns 404 for it', async () => {
    const note: NoteBodyInterface = await createNote('to-delete');

    await request(app.getHttpServer()).delete(`/api/v1/notes/${note.id}`).expect(204);

    const response = await request(app.getHttpServer()).get(`/api/v1/notes/${note.id}`).expect(404);

    expect(response.body.code).toBe('NOTE_NOT_FOUND');
  });
});
