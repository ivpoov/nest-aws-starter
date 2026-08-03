import type {
  ApiErrorInterface,
  CreateNoteRequestInterface,
  NoteListResponseInterface,
  NoteResponseInterface,
  UpdateNoteRequestInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createNote, deleteNote, fetchNotes, updateNote } from '../../apis/notes';
import type { UseNotesResultInterface } from '../../interfaces/use-notes-result.interface';
import { toApiError } from '../../utils/toApiError';

const PAGE_SIZE = 10;

export function useNotes(): UseNotesResultInterface {
  const [notes, setNotes] = useState<NoteResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const cursorRef = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const loadPage = useCallback(async (isFresh: boolean): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const cursor: string | null = isFresh ? null : cursorRef.current;
      const page: NoteListResponseInterface = await fetchNotes(PAGE_SIZE, cursor);

      cursorRef.current = page.nextCursor;
      setHasMore(page.nextCursor !== null);
      setNotes((current: NoteResponseInterface[]): NoteResponseInterface[] =>
        isFresh ? page.items : [...current, ...page.items],
      );
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (): Promise<void> => loadPage(false), [loadPage]);

  const create = useCallback(
    async (body: CreateNoteRequestInterface): Promise<void> => {
      try {
        await createNote(body);
        await loadPage(true);
      } catch (caught) {
        setError(toApiError(caught));
      }
    },
    [loadPage],
  );

  const update = useCallback(
    async (id: string, body: UpdateNoteRequestInterface): Promise<void> => {
      try {
        await updateNote(id, body);
        await loadPage(true);
      } catch (caught) {
        setError(toApiError(caught));
      }
    },
    [loadPage],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteNote(id);
        await loadPage(true);
      } catch (caught) {
        setError(toApiError(caught));
      }
    },
    [loadPage],
  );

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  return { notes, hasMore, isLoading, error, loadMore, create, update, remove };
}
