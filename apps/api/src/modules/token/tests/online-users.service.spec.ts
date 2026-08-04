import type { OnlineUsersRepositoryInterface } from '@modules/token/interfaces/online-users-repository.interface.js';
import { OnlineUsersService } from '@modules/token/services/online-users.service.js';
import { describe, expect, it, vi } from 'vitest';

function createService(overrides: Partial<OnlineUsersRepositoryInterface> = {}): {
  service: OnlineUsersService;
  repository: OnlineUsersRepositoryInterface;
} {
  const repository: OnlineUsersRepositoryInterface = {
    touch: vi.fn().mockResolvedValue(undefined),
    countActive: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
  const service: OnlineUsersService = new OnlineUsersService(repository);

  return { service, repository };
}

describe('OnlineUsersService', () => {
  it('touches the repository for a userId', async () => {
    const { service, repository } = createService();

    await service.touch('user-1');

    expect(repository.touch).toHaveBeenCalledWith('user-1');
  });

  it('swallows a repository failure instead of throwing', async () => {
    const { service } = createService({
      touch: vi.fn().mockRejectedValue(new Error('redis down')),
    });

    await expect(service.touch('user-1')).resolves.toBeUndefined();
  });

  it('delegates countActive with the given window', async () => {
    const { service, repository } = createService({ countActive: vi.fn().mockResolvedValue(7) });

    const count: number = await service.countActive(300);

    expect(count).toBe(7);
    expect(repository.countActive).toHaveBeenCalledWith(300);
  });
});
