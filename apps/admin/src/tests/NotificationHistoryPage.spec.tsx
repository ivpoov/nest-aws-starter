import {
  NotificationAudienceEnum,
  type NotificationResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import { NotificationHistoryPage } from '../pages/NotificationHistoryPage';

vi.mock('../apis/notifications');

const adjustUnreadCount = vi.fn();
const refreshUnreadCount = vi.fn().mockResolvedValue(undefined);

vi.mock('../contexts/NotificationSocketContext', () => ({
  useNotificationSocketContext: () => ({ unreadCount: 2, adjustUnreadCount, refreshUnreadCount }),
}));

function buildItem(
  id: string,
  type: NotificationTypeEnum,
  audience: NotificationAudienceEnum,
  meta: Record<string, unknown> = {},
): NotificationResponseInterface {
  return {
    id,
    audience,
    userId: audience === NotificationAudienceEnum.USER ? 'u-1' : null,
    type,
    title: `Title ${id}`,
    body: 'Body',
    meta,
    createdAt: '2026-08-01T00:00:00.000Z',
    readAt: null,
  };
}

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationHistoryPage />} />
        <Route path="/inbox" element={<p>Inbox page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotificationHistoryPage', () => {
  beforeEach(() => {
    adjustUnreadCount.mockClear();
    refreshUnreadCount.mockClear();
    vi.mocked(notificationsApi.markNotificationRead).mockResolvedValue(undefined);
  });

  it('marks read and navigates to the inbox item when a CONTACT_MESSAGE row is clicked', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [
        buildItem('n-1', NotificationTypeEnum.CONTACT_MESSAGE, NotificationAudienceEnum.ADMIN, {
          contactMessageId: 'msg-1',
        }),
      ],
      nextCursor: null,
    });

    renderPage();

    fireEvent.click(await screen.findByText('Title n-1'));

    expect(await screen.findByText('Inbox page')).toBeInTheDocument();
    expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('n-1');
  });

  it('marks a WEBHOOK_FAILED row read but does not navigate — no admin view exists for it', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [
        buildItem('n-2', NotificationTypeEnum.WEBHOOK_FAILED, NotificationAudienceEnum.ADMIN, {
          webhookEventId: 'wh-1',
        }),
      ],
      nextCursor: null,
    });

    renderPage();

    fireEvent.click(await screen.findByText('Title n-2'));

    await waitFor(() => expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('n-2'));
    expect(screen.queryByText('Inbox page')).not.toBeInTheDocument();
    expect(screen.getByText('Title n-2')).toBeInTheDocument();
  });

  it('filters the rendered rows by type via the filter bar (client-side)', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [
        buildItem('n-1', NotificationTypeEnum.PASSWORD_CHANGED, NotificationAudienceEnum.USER),
        buildItem('n-2', NotificationTypeEnum.WEBHOOK_FAILED, NotificationAudienceEnum.ADMIN),
      ],
      nextCursor: null,
    });

    renderPage();

    await screen.findByText('Title n-1');
    expect(screen.getByText('Title n-2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: NotificationTypeEnum.WEBHOOK_FAILED }));

    await waitFor(() => expect(screen.queryByText('Title n-1')).not.toBeInTheDocument());
    expect(screen.getByText('Title n-2')).toBeInTheDocument();
  });
});
