import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersApi from '../apis/users';
import { AdminGate } from '../components/Layout/AdminGate';
import { useAuthStore } from '../stores/auth.store';

vi.mock('../apis/users');

function renderGate(): void {
  render(
    <MemoryRouter initialEntries={['/users']}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route element={<AdminGate />}>
          <Route path="/users" element={<p>users page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminGate', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  it('redirects to login without a token', () => {
    renderGate();

    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('shows the 403 screen for a non-admin account', async () => {
    useAuthStore.getState().setTokens('token', 'refresh');
    vi.mocked(usersApi.fetchMe).mockResolvedValue({ role: 'USER' } as never);

    renderGate();

    await waitFor((): void => {
      expect(screen.getByText(/403/)).toBeInTheDocument();
    });
  });

  it('renders the guarded outlet for an admin', async () => {
    useAuthStore.getState().setTokens('token', 'refresh');
    vi.mocked(usersApi.fetchMe).mockResolvedValue({ role: 'ADMIN' } as never);

    renderGate();

    await waitFor((): void => {
      expect(screen.getByText('users page')).toBeInTheDocument();
    });
  });
});
