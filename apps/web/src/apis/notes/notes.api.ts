import type {
  CreateNoteRequestInterface,
  NoteListResponseInterface,
  NoteResponseInterface,
  UpdateNoteRequestInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchNotes(
  limit: number,
  cursor: string | null,
): Promise<NoteListResponseInterface> {
  const query: string = cursor ? `?limit=${limit}&cursor=${cursor}` : `?limit=${limit}`;

  return apiClient.get<NoteListResponseInterface>(`/notes${query}`);
}

export function createNote(body: CreateNoteRequestInterface): Promise<NoteResponseInterface> {
  return apiClient.post<NoteResponseInterface>('/notes', body);
}

export function updateNote(
  id: string,
  body: UpdateNoteRequestInterface,
): Promise<NoteResponseInterface> {
  return apiClient.patch<NoteResponseInterface>(`/notes/${id}`, body);
}

export function deleteNote(id: string): Promise<void> {
  return apiClient.delete<void>(`/notes/${id}`);
}
