import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersApi from '../apis/users';
import { ProfilePage } from '../pages/ProfilePage';

vi.mock('../apis/users');

const profile = {
  id: 'user-1',
  displayName: 'Jane Doe',
  role: 'USER',
  status: 'ACTIVE',
  avatarUrl: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function imageFile(name: string, sizeBytes: number, type: string): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('ProfilePage avatar upload', () => {
  beforeEach(() => {
    vi.mocked(usersApi.fetchMe).mockResolvedValue(profile as never);
    vi.mocked(usersApi.uploadAvatar).mockResolvedValue(undefined);
  });

  it('shows an inline error and skips the upload for an oversize file', async () => {
    render(<ProfilePage />);

    const input: HTMLInputElement = await screen.findByLabelText('Change avatar');
    const oversized: File = imageFile('avatar.png', 3 * 1024 * 1024, 'image/png');

    fireEvent.change(input, { target: { files: [oversized] } });

    expect(
      await screen.findByText('File exceeds the maximum size allowed for this upload'),
    ).toBeInTheDocument();
    expect(usersApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('shows an inline error and skips the upload for a disallowed type', async () => {
    render(<ProfilePage />);

    const input: HTMLInputElement = await screen.findByLabelText('Change avatar');
    const wrongType: File = imageFile('avatar.svg', 1024, 'image/svg+xml');

    fireEvent.change(input, { target: { files: [wrongType] } });

    expect(await screen.findByText('This file type is not allowed')).toBeInTheDocument();
    expect(usersApi.uploadAvatar).not.toHaveBeenCalled();
  });

  it('uploads a valid avatar and reloads the profile', async () => {
    render(<ProfilePage />);

    const input: HTMLInputElement = await screen.findByLabelText('Change avatar');
    const valid: File = imageFile('avatar.png', 1024, 'image/png');

    fireEvent.change(input, { target: { files: [valid] } });

    await waitFor(() => expect(usersApi.uploadAvatar).toHaveBeenCalledWith(valid));
  });
});
