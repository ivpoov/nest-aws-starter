import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteRepositoryInterface } from '@modules/note/interfaces/note-repository.interface.js';
import { NoteService } from '@modules/note/services/note.service.js';
import { NoteStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const ownerId = '01890a5d-0000-774b-bcce-b30209990001';

const note: NoteInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  userId: ownerId,
  title: 'First note',
  body: '',
  status: NoteStatusEnum.ACTIVE,
  createdAt: new Date('2026-08-02T12:00:00Z'),
  updatedAt: new Date('2026-08-02T12:00:00Z'),
};

interface TestSetupInterface {
  readonly service: NoteService;
  readonly repository: NoteRepositoryInterface;
  readonly emit: ReturnType<typeof vi.fn>;
}

function createService(overrides: Partial<NoteRepositoryInterface> = {}): TestSetupInterface {
  const repository: NoteRepositoryInterface = {
    create: vi.fn().mockResolvedValue(note),
    findById: vi.fn().mockResolvedValue(note),
    findManyAfter: vi.fn().mockResolvedValue([note]),
    update: vi.fn().mockResolvedValue(note),
    deleteById: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  const emit = vi.fn();
  const eventBus = { emit } as unknown as EventBusService;
  const service: NoteService = new NoteService(repository, eventBus);

  return { service, repository, emit };
}

describe('NoteService', () => {
  it('creates a note and emits note.created', async () => {
    const { service, emit } = createService();

    const created: NoteInterface = await service.create({ userId: ownerId, title: 'First note' });

    expect(created).toEqual(note);
    expect(emit).toHaveBeenCalledWith('note.created', { noteId: note.id });
  });

  it('throws the coded not-found error for a missing id', async () => {
    const { service } = createService({ findById: vi.fn().mockResolvedValue(null) });

    try {
      await service.findByIdOrThrow('missing-id', ownerId);
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NotFoundError);
      expect((caught as NotFoundError).args.code).toBe('NOTE_NOT_FOUND');
    }
  });

  it('denies reading, updating and deleting a foreign note', async () => {
    const { service, repository } = createService();
    const strangerId = '01890a5d-0000-774b-bcce-b30209990002';

    for (const attempt of [
      (): Promise<unknown> => service.findByIdOrThrow(note.id, strangerId),
      (): Promise<unknown> => service.update(note.id, strangerId, { title: 'hijack' }),
      (): Promise<unknown> => service.deleteById(note.id, strangerId),
    ]) {
      const caught: unknown = await attempt()
        .then(() => null)
        .catch((error: unknown): unknown => error);

      expect(caught).toBeInstanceOf(ForbiddenError);
      expect((caught as ForbiddenError).args.code).toBe('NOTE_ACCESS_DENIED');
    }

    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it('maps a concurrent delete to the domain 404 instead of a 500', async () => {
    const { service } = createService({ deleteById: vi.fn().mockResolvedValue(false) });

    try {
      await service.deleteById(note.id, ownerId);
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NotFoundError);
      expect((caught as NotFoundError).args.code).toBe('NOTE_NOT_FOUND');
    }
  });

  it('maps an update of a vanished note to the domain 404', async () => {
    const { service } = createService({ update: vi.fn().mockResolvedValue(null) });

    await expect(service.update(note.id, ownerId, { title: 'late update' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('scopes the list to the owner and pages by cursor', async () => {
    const secondNote: NoteInterface = { ...note, id: '01890a5d-ac96-774b-bcce-b302099a9999' };
    const findManyAfter = vi.fn().mockResolvedValue([note, secondNote]);
    const { service } = createService({ findManyAfter });

    const fullPage = await service.findMany(ownerId, { cursor: null, limit: 2 });

    expect(findManyAfter).toHaveBeenCalledWith(ownerId, { cursor: null, limit: 2 });
    expect(fullPage.items).toHaveLength(2);
    expect(fullPage.nextCursor).toBe(secondNote.id);

    const { service: shortService } = createService({
      findManyAfter: vi.fn().mockResolvedValue([note]),
    });
    const shortPage = await shortService.findMany(ownerId, { cursor: null, limit: 2 });

    expect(shortPage.nextCursor).toBeNull();
  });
});
