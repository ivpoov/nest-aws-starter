import { OauthAvatarListener } from '@modules/user/listeners/oauth-avatar.listener.js';
import type { UserService } from '@modules/user/services/user.service.js';
import type { HttpClientService } from '@providers/http-client/services/http-client.service.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';
import { describe, expect, it, vi } from 'vitest';

interface SetupInterface {
  readonly listener: OauthAvatarListener;
  readonly httpClient: { download: ReturnType<typeof vi.fn> };
  readonly s3Provider: { upload: ReturnType<typeof vi.fn> };
  readonly users: { updateProfile: ReturnType<typeof vi.fn> };
}

function setup(): SetupInterface {
  const httpClient = {
    download: vi
      .fn()
      .mockResolvedValue({ contentType: 'image/png', body: Buffer.from([0x89, 0x50]) }),
  };
  const s3Provider = { upload: vi.fn().mockResolvedValue('avatars/u-1') };
  const users = { updateProfile: vi.fn().mockResolvedValue(undefined) };
  const listener: OauthAvatarListener = new OauthAvatarListener(
    httpClient as unknown as HttpClientService,
    s3Provider as unknown as S3ProviderInterface,
    users as unknown as UserService,
  );

  return { listener, httpClient, s3Provider, users };
}

describe('OauthAvatarListener', () => {
  it('downloads the avatar, uploads it under the user key and saves the key', async () => {
    const { listener, s3Provider, users } = setup();

    await listener.handle({ userId: 'u-1', avatarUrl: 'https://cdn.example/pic.png' });

    expect(s3Provider.upload).toHaveBeenCalledWith({
      key: 'avatars/u-1',
      body: Buffer.from([0x89, 0x50]),
      contentType: 'image/png',
    });
    expect(users.updateProfile).toHaveBeenCalledWith('u-1', { avatarKey: 'avatars/u-1' });
  });

  it('does nothing without an avatar url', async () => {
    const { listener, httpClient } = setup();

    await listener.handle({ userId: 'u-1', avatarUrl: null });

    expect(httpClient.download).not.toHaveBeenCalled();
  });

  it('swallows failures so signup is never affected', async () => {
    const { listener, httpClient, users } = setup();

    httpClient.download.mockRejectedValue(new Error('boom'));

    await expect(
      listener.handle({ userId: 'u-1', avatarUrl: 'https://cdn.example/pic.png' }),
    ).resolves.toBeUndefined();
    expect(users.updateProfile).not.toHaveBeenCalled();
  });
});
