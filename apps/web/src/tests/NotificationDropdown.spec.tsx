import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import { NotificationDropdown } from '../components/Notifications/NotificationDropdown';

vi.mock('../apis/notifications');

const contextValue = {
  unreadCount: 0,
  liveNotifications: [],
  isConnected: true,
  adjustUnreadCount: vi.fn(),
  refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../contexts/NotificationSocketContext', () => ({
  useNotificationSocketContext: () => contextValue,
}));

function renderDropdown(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <NotificationDropdown onItemOpened={() => undefined} />
    </MemoryRouter>,
  );
}

describe('NotificationDropdown', () => {
  beforeEach(() => {
    contextValue.isConnected = true;
    vi.mocked(notificationsApi.fetchNotifications).mockReset();
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
  });

  it('shows a degraded-mode notice while the socket is disconnected', async () => {
    contextValue.isConnected = false;

    renderDropdown();

    const notice: HTMLElement = await screen.findByRole('status');

    expect(notice).toHaveTextContent('Live updates are currently unavailable');
  });

  it('does not show the degraded-mode notice while the socket is connected', async () => {
    renderDropdown();

    await waitFor(() => expect(screen.getByText('No notifications yet')).toBeInTheDocument());

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
