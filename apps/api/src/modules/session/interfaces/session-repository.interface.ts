import type { CreateSessionDataInterface } from '@modules/session/interfaces/create-session-data.interface.js';
import type { SessionInterface } from '@modules/session/interfaces/session.interface.js';

export interface SessionRepositoryInterface {
  create(data: CreateSessionDataInterface): Promise<SessionInterface>;
  findById(id: string): Promise<SessionInterface | null>;
  findActiveByUserId(userId: string, now: Date): Promise<SessionInterface[]>;
  touchLastActive(id: string, now: Date): Promise<void>;
  setActiveUntil(id: string, activeUntil: Date): Promise<boolean>;
  endAllByUserId(userId: string, now: Date): Promise<number>;
}
