import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from '../components/Layout/AppLayout';
import { useAuthStore } from '../stores/auth.store';

// This suite only cares about the impersonation banner — the bell's own
// behaviour (badge, socket lifecycle) is covered by NotificationBell.spec.tsx
// and useNotificationSocket.spec.ts, so it is stubbed out here to avoid
// needing a NotificationSocketProvider (and a mocked socket.io-client) just
// to render the layout shell.
vi.mock('../components/Notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeJwt(payload: Record<string, unknown>): string {
  return `header.${base64UrlEncode(JSON.stringify(payload))}.signature`;
}

const BANNER_TEXT = 'Viewing as this user — session started by an admin';

describe('AppLayout impersonation banner', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  it('shows the banner when the access token carries actAsBy', () => {
    const token: string = fakeJwt({ sessionId: 's-1', role: 'USER', actAsBy: 'admin-1' });

    useAuthStore.getState().setTokens(token, 'refresh');

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it('hides the banner for a normal session token', () => {
    const token: string = fakeJwt({ sessionId: 's-1', role: 'USER' });

    useAuthStore.getState().setTokens(token, 'refresh');

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('hides the banner when there is no access token', () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });
});
