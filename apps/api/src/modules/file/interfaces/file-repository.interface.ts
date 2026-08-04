import type { CreateFileDataInterface } from '@modules/file/interfaces/create-file-data.interface.js';
import type { FileInterface } from '@modules/file/interfaces/file.interface.js';
import type { MarkFileReadyDataInterface } from '@modules/file/interfaces/mark-file-ready-data.interface.js';

export interface FileRepositoryInterface {
  create(data: CreateFileDataInterface): Promise<FileInterface>;
  findById(id: string): Promise<FileInterface | null>;
  markReady(id: string, data: MarkFileReadyDataInterface): Promise<FileInterface | null>;
}
