import type {
  ApiErrorInterface,
  CreateNoteRequestInterface,
  NoteResponseInterface,
  UpdateNoteRequestInterface,
} from '@nest-aws-starter/shared';

export interface UseNotesResultInterface {
  readonly notes: NoteResponseInterface[];
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly loadMore: () => Promise<void>;
  readonly create: (body: CreateNoteRequestInterface) => Promise<void>;
  readonly update: (id: string, body: UpdateNoteRequestInterface) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
}
