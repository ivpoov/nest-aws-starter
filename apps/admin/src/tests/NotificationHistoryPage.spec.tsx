import {
  NotificationAudienceEnum,
  type NotificationResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import { NOTIFICATION_HISTORY_PAGE_SIZE } from '../constants/notification-history.constants';
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
        <Route path="/users" element={<p>Users page</p>} />
        <Route path="/activities" element={<p>Activities page</p>} />
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

  it('marks read and navigates to the user drawer when a USER_BLOCKED row is clicked', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [
        buildItem('n-3', NotificationTypeEnum.USER_BLOCKED, NotificationAudienceEnum.ADMIN, {
          userId: 'u-42',
          actorId: 'admin-1',
          reason: 'spam',
        }),
      ],
      nextCursor: null,
    });

    renderPage();

    fireEvent.click(await screen.findByText('Title n-3'));

    expect(await screen.findByText('Users page')).toBeInTheDocument();
    expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('n-3');
  });

  it('marks read and navigates to the activity log when a SUSPICIOUS_LOGIN row is clicked', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [
        buildItem('n-4', NotificationTypeEnum.SUSPICIOUS_LOGIN, NotificationAudienceEnum.ADMIN, {
          scope: 'IP',
          value: '1.2.3.4',
        }),
      ],
      nextCursor: null,
    });

    renderPage();

    fireEvent.click(await screen.findByText('Title n-4'));

    expect(await screen.findByText('Activities page')).toBeInTheDocument();
    expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('n-4');
  });

  it('still does not navigate for a USER_BLOCKED row whose meta has no userId', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [
        buildItem('n-5', NotificationTypeEnum.USER_BLOCKED, NotificationAudienceEnum.ADMIN, {}),
      ],
      nextCursor: null,
    });

    renderPage();

    fireEvent.click(await screen.findByText('Title n-5'));

    await waitFor(() => expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('n-5'));
    expect(screen.queryByText('Users page')).not.toBeInTheDocument();
  });

  it('refetches page one with a type param when a type chip is picked', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [
        buildItem('n-1', NotificationTypeEnum.PASSWORD_CHANGED, NotificationAudienceEnum.USER),
        buildItem('n-2', NotificationTypeEnum.WEBHOOK_FAILED, NotificationAudienceEnum.ADMIN),
      ],
      nextCursor: 'n-2',
    });

    renderPage();

    await screen.findByText('Title n-1');
    expect(screen.getByText('Title n-2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();

    // The server owns the filtering now, so the chip click produces a fresh
    // request — and a `nextCursor` for the *filtered* result set, not the
    // unfiltered one that was on screen a moment ago. That pairing is the bug
    // this replaced: a filtered page next to a "Load more" button driven by an
    // unfiltered cursor.
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [
        buildItem('n-2', NotificationTypeEnum.WEBHOOK_FAILED, NotificationAudienceEnum.ADMIN),
      ],
      nextCursor: null,
    });

    fireEvent.click(screen.getByRole('button', { name: NotificationTypeEnum.WEBHOOK_FAILED }));

    await waitFor(() => expect(screen.queryByText('Title n-1')).not.toBeInTheDocument());
    expect(screen.getByText('Title n-2')).toBeInTheDocument();
    expect(notificationsApi.fetchNotifications).toHaveBeenLastCalledWith({
      limit: NOTIFICATION_HISTORY_PAGE_SIZE,
      type: NotificationTypeEnum.WEBHOOK_FAILED,
    });
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('refetches with unreadOnly when the Unread chip is picked', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [
        buildItem('n-1', NotificationTypeEnum.PASSWORD_CHANGED, NotificationAudienceEnum.USER),
      ],
      nextCursor: null,
    });

    renderPage();

    await screen.findByText('Title n-1');

    fireEvent.click(screen.getByRole('button', { name: 'Unread' }));

    await waitFor(() =>
      expect(notificationsApi.fetchNotifications).toHaveBeenLastCalledWith({
        limit: NOTIFICATION_HISTORY_PAGE_SIZE,
        unreadOnly: true,
      }),
    );
  });
});
