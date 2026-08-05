import type { CreateFileDataInterface } from '@modules/file/interfaces/create-file-data.interface.js';
import type { FileInterface } from '@modules/file/interfaces/file.interface.js';
import type { MarkFileReadyDataInterface } from '@modules/file/interfaces/mark-file-ready-data.interface.js';

export interface FileRepositoryInterface {
  create(data: CreateFileDataInterface): Promise<FileInterface>;
  findById(id: string): Promise<FileInterface | null>;
  markReady(id: string, data: MarkFileReadyDataInterface): Promise<FileInterface | null>;
  // Orphan-sweep candidates: PENDING rows older than the cutoff, oldest
  // first, capped at limit.
  findStalePending(cutoff: Date, limit: number): Promise<FileInterface[]>;
  deleteById(id: string): Promise<void>;
}
