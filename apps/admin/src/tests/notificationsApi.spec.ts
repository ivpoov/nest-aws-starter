import { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNotifications } from '../apis/notifications';
import { apiClient } from '../utils/apiClient';

// The query string is the whole contract surface of this function, and the
// server validates it strictly (400 on a `type` outside the enum, only the
// literal string 'true' read as unreadOnly=true), so every param is asserted
// on the URL rather than on the caller's intent.
describe('fetchNotifications', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends no query string at all when no params are given', async () => {
    await fetchNotifications({});

    expect(apiClient.get).toHaveBeenCalledWith('/notifications');
  });

  it('serializes cursor, limit, unreadOnly, type and audience together', async () => {
    await fetchNotifications({
      cursor: '0198c0de-0000-7000-8000-000000000001',
      limit: 20,
      unreadOnly: true,
      type: NotificationTypeEnum.WEBHOOK_FAILED,
      audience: NotificationAudienceEnum.ADMIN,
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/notifications?cursor=0198c0de-0000-7000-8000-000000000001&limit=20&unreadOnly=true&type=WEBHOOK_FAILED&audience=ADMIN',
    );
  });

  it('omits unreadOnly entirely when it is false rather than sending unreadOnly=false', async () => {
    await fetchNotifications({ limit: 20, unreadOnly: false });

    expect(apiClient.get).toHaveBeenCalledWith('/notifications?limit=20');
  });
});
