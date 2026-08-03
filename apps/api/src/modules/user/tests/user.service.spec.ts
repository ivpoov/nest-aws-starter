import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserRepositoryInterface } from '@modules/user/interfaces/user-repository.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const user: UserInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  displayName: 'Igor',
  role: UserRoleEnum.USER,
  status: UserStatusEnum.ACTIVE,
  avatarKey: null,
  createdAt: new Date('2026-08-03T12:00:00Z'),
  updatedAt: new Date('2026-08-03T12:00:00Z'),
};

function createService(overrides: Partial<UserRepositoryInterface> = {}): UserService {
  const repository: UserRepositoryInterface = {
    createWithEmailMethod: vi.fn().mockResolvedValue(user),
    createWithOauthMethod: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
    findByAuthEmail: vi.fn().mockResolvedValue(null),
    updateProfile: vi.fn().mockResolvedValue(user),
    ...overrides,
  };

  return new UserService(repository);
}

describe('UserService', () => {
  it('creates a user with an email method', async () => {
    const service: UserService = createService();

    const created: UserInterface = await service.createWithEmailMethod({
      displayName: 'Igor',
      email: 'igor@example.com',
      passwordHash: 'argon2-hash',
    });

    expect(created).toEqual(user);
  });

  it('throws the coded not-found error for a missing user', async () => {
    const service: UserService = createService({ findById: vi.fn().mockResolvedValue(null) });

    try {
      await service.findByIdOrThrow('missing-id');
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NotFoundError);
      expect((caught as NotFoundError).args.code).toBe('USER_NOT_FOUND');
    }
  });

  it('maps a profile update of a vanished user to the domain 404', async () => {
    const service: UserService = createService({
      updateProfile: vi.fn().mockResolvedValue(null),
    });

    await expect(service.updateProfile(user.id, { displayName: 'New' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('passes findByAuthEmail through to the repository', async () => {
    const findByAuthEmail = vi.fn().mockResolvedValue(null);
    const service: UserService = createService({ findByAuthEmail });

    const result = await service.findByAuthEmail('nobody@example.com');

    expect(result).toBeNull();
    expect(findByAuthEmail).toHaveBeenCalledWith('nobody@example.com');
  });
});
