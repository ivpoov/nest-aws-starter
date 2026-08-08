import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '../components/Notifications/NotificationBell';

const contextValue = {
  unreadCount: 0,
  isConnected: true,
  adjustUnreadCount: vi.fn(),
  refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../contexts/NotificationSocketContext', () => ({
  useNotificationSocketContext: () => contextValue,
}));

vi.mock('../components/Notifications/NotificationDropdown', () => ({
  NotificationDropdown: () => (
    <div>
      <button type="button">First notification</button>
    </div>
  ),
}));

function bell(): HTMLElement {
  return screen.getByRole('button', { name: /^Notifications/ });
}

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

  // aria-label overrides the button's text content, so a bare
  // aria-label="Notifications" makes the badge invisible to assistive
  // technology at every count.
  it('carries the unread count in the bell accessible name', () => {
    contextValue.unreadCount = 4;

    render(<NotificationBell />);

    expect(screen.getByRole('button', { name: 'Notifications, 4 unread' })).toBeInTheDocument();
  });

  it('drops the count from the accessible name when nothing is unread', () => {
    contextValue.unreadCount = 0;

    render(<NotificationBell />);

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('announces the count through a live region that is mounted at zero too', () => {
    contextValue.unreadCount = 0;

    const { rerender } = render(<NotificationBell />);
    const liveRegion: HTMLElement = screen.getByRole('status');

    expect(liveRegion).toHaveTextContent('No unread notifications');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    contextValue.unreadCount = 7;
    rerender(<NotificationBell />);

    expect(screen.getByRole('status')).toHaveTextContent('7 unread notifications');
  });

  it('opens the dropdown on click and closes it again on Escape', async () => {
    contextValue.unreadCount = 1;
    const user = userEvent.setup();

    render(<NotificationBell />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(bell());

    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the panel on open and back to the bell on close', async () => {
    contextValue.unreadCount = 1;
    const user = userEvent.setup();

    render(<NotificationBell />);

    await user.click(bell());

    expect(screen.getByRole('dialog')).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(bell()).toHaveFocus();
  });

  // The outside-click catcher covers the whole viewport; in the tab order it
  // sits between the bell and the first notification, so a keyboard user
  // tabs into an invisible full-screen control first.
  it('keeps the outside-click catcher out of the tab order', async () => {
    contextValue.unreadCount = 1;
    const user = userEvent.setup();

    render(<NotificationBell />);

    await user.click(bell());
    await user.tab();

    expect(screen.getByRole('button', { name: 'First notification' })).toHaveFocus();
  });
});
