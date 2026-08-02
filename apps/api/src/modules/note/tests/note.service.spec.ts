import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import { NoteStatusEnum } from '@modules/note/enums/note-status.enum.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteRepositoryInterface } from '@modules/note/interfaces/note-repository.interface.js';
import { NoteService } from '@modules/note/services/note.service.js';
import { describe, expect, it, vi } from 'vitest';

const note: NoteInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
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
    deleteById: vi.fn().mockResolvedValue(undefined),
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

    const created: NoteInterface = await service.create({ title: 'First note' });

    expect(created).toEqual(note);
    expect(emit).toHaveBeenCalledWith('note.created', { noteId: note.id });
  });

  it('throws the coded not-found error for a missing id', async () => {
    const { service } = createService({ findById: vi.fn().mockResolvedValue(null) });

    try {
      await service.findByIdOrThrow('missing-id');
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NotFoundError);
      expect((caught as NotFoundError).args.code).toBe('NOTE_NOT_FOUND');
    }
  });

  it('refuses to delete a missing note', async () => {
    const { service, repository } = createService({ findById: vi.fn().mockResolvedValue(null) });

    await expect(service.deleteById('missing-id')).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it('returns a nextCursor only when the page is full', async () => {
    const secondNote: NoteInterface = { ...note, id: '01890a5d-ac96-774b-bcce-b302099a9999' };
    const { service } = createService({
      findManyAfter: vi.fn().mockResolvedValue([note, secondNote]),
    });

    const fullPage = await service.findMany({ cursor: null, limit: 2 });

    expect(fullPage.items).toHaveLength(2);
    expect(fullPage.nextCursor).toBe(secondNote.id);

    const { service: shortService } = createService({
      findManyAfter: vi.fn().mockResolvedValue([note]),
    });
    const shortPage = await shortService.findMany({ cursor: null, limit: 2 });

    expect(shortPage.nextCursor).toBeNull();
  });
});
