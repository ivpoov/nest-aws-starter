import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '../components/Notifications/NotificationBell';

const contextValue = {
  unreadCount: 0,
  liveNotifications: [],
  isConnected: true,
  adjustUnreadCount: () => undefined,
  refreshUnreadCount: async () => undefined,
};

vi.mock('../contexts/NotificationSocketContext', () => ({
  useNotificationSocketContext: () => contextValue,
}));

vi.mock('../components/Notifications/NotificationDropdown', () => ({
  NotificationDropdown: () => <div>Dropdown contents</div>,
}));

describe('NotificationBell', () => {
  it('hides the badge when there are no unread notifications', () => {
    contextValue.unreadCount = 0;

    render(<NotificationBell />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the unread count badge', () => {
    contextValue.unreadCount = 4;

    render(<NotificationBell />);

    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('caps the displayed badge at 99+', () => {
    contextValue.unreadCount = 150;

    render(<NotificationBell />);

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('opens the dropdown on click and closes it again', async () => {
    contextValue.unreadCount = 1;
    const user = userEvent.setup();

    render(<NotificationBell />);

    expect(screen.queryByText('Dropdown contents')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.getByText('Dropdown contents')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close notifications' }));

    expect(screen.queryByText('Dropdown contents')).not.toBeInTheDocument();
  });
});
