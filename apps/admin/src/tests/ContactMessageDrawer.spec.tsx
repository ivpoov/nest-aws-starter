import {
  type ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as contactApi from '../apis/contact';
import { ContactMessageDrawer } from '../components/Contact/ContactMessageDrawer';

vi.mock('../apis/contact');

const OPEN_MESSAGE: ContactMessageResponseInterface = {
  id: 'm-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Pricing question',
  body: 'Hi, I would like to know more.',
  status: ContactMessageStatusEnum.OPEN,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('ContactMessageDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there is no selected message', () => {
    const { container } = render(
      <ContactMessageDrawer message={null} onClose={vi.fn()} onStatusChanged={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the OPEN badge and full message detail', () => {
    render(
      <ContactMessageDrawer message={OPEN_MESSAGE} onClose={vi.fn()} onStatusChanged={vi.fn()} />,
    );

    expect(screen.getByText('OPEN')).toBeInTheDocument();
    expect(screen.getByText('Hi, I would like to know more.')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe <jane@example.com>')).toBeInTheDocument();
  });

  it('resolves an open message and notifies the parent to reload the list', async () => {
    vi.mocked(contactApi.updateContactMessageStatus).mockResolvedValue({
      ...OPEN_MESSAGE,
      status: ContactMessageStatusEnum.RESOLVED,
    });
    const onStatusChanged = vi.fn();

    render(
      <ContactMessageDrawer
        message={OPEN_MESSAGE}
        onClose={vi.fn()}
        onStatusChanged={onStatusChanged}
      />,
    );

    fireEvent.click(screen.getByText('Resolve'));

    await waitFor((): void => {
      expect(contactApi.updateContactMessageStatus).toHaveBeenCalledWith(
        'm-1',
        ContactMessageStatusEnum.RESOLVED,
      );
    });
    await waitFor((): void => expect(onStatusChanged).toHaveBeenCalled());
  });

  it('shows Reopen for a resolved message', () => {
    render(
      <ContactMessageDrawer
        message={{ ...OPEN_MESSAGE, status: ContactMessageStatusEnum.RESOLVED }}
        onClose={vi.fn()}
        onStatusChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Reopen')).toBeInTheDocument();
  });

  it('surfaces an inline error and does not notify the parent when the update fails', async () => {
    vi.mocked(contactApi.updateContactMessageStatus).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL',
      details: 'Could not update the message',
      timestamp: '',
      path: '',
    });
    const onStatusChanged = vi.fn();

    render(
      <ContactMessageDrawer
        message={OPEN_MESSAGE}
        onClose={vi.fn()}
        onStatusChanged={onStatusChanged}
      />,
    );

    fireEvent.click(screen.getByText('Resolve'));

    expect(await screen.findByText('Could not update the message')).toBeInTheDocument();
    expect(onStatusChanged).not.toHaveBeenCalled();
  });
});
