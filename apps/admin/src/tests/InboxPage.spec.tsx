import {
  type ContactMessageListResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as contactApi from '../apis/contact';
import { InboxPage } from '../pages/InboxPage';

vi.mock('../apis/contact');

function renderInboxPage(initialEntry = '/inbox'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <InboxPage />
    </MemoryRouter>,
  );
}

// Simulates clicking a second CONTACT_MESSAGE notification while already on
// /inbox (no remount) — a plain second `render` with new initialEntries
// can't exercise that, since it always mounts fresh.
function NavigateToSecondMessageButton(): ReactElement {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={(): void => void navigate('/inbox?messageId=m-2')}>
      go to second message
    </button>
  );
}

function renderInboxPageWithNavigation(initialEntry: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavigateToSecondMessageButton />
      <InboxPage />
    </MemoryRouter>,
  );
}

const OPEN_PAGE: ContactMessageListResponseInterface = {
  items: [
    {
      id: 'm-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'Pricing question',
      body: 'Hi, I would like to know more.',
      status: ContactMessageStatusEnum.OPEN,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ],
  nextCursor: null,
};

const TWO_MESSAGE_PAGE: ContactMessageListResponseInterface = {
  items: [
    ...OPEN_PAGE.items,
    {
      id: 'm-2',
      name: 'John Roe',
      email: 'john@example.com',
      subject: 'Refund request',
      body: 'I would like a refund.',
      status: ContactMessageStatusEnum.OPEN,
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    },
  ],
  nextCursor: null,
};

describe('InboxPage', () => {
  beforeEach(() => {
    // mockReset first: a `mockResolvedValueOnce` a test queues but never
    // consumes would otherwise leak into the next one.
    vi.mocked(contactApi.fetchContactMessages).mockReset();
    vi.mocked(contactApi.fetchContactMessages).mockResolvedValue(OPEN_PAGE);
  });

  it('renders the subject, from, and an OPEN badge for each message', async () => {
    renderInboxPage();

    const subjectCell: HTMLElement = await screen.findByText('Pricing question');
    const row: HTMLElement | null = subjectCell.closest('tr');

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('OPEN')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe <jane@example.com>')).toBeInTheDocument();
  });

  it('refetches with the selected status when a filter chip is clicked', async () => {
    renderInboxPage();

    await screen.findByText('Pricing question');

    fireEvent.click(screen.getByText('RESOLVED'));

    await waitFor((): void => {
      expect(contactApi.fetchContactMessages).toHaveBeenLastCalledWith(
        20,
        null,
        ContactMessageStatusEnum.RESOLVED,
      );
    });
  });

  it('opens the drawer for the selected message on row click', async () => {
    renderInboxPage();

    fireEvent.click(await screen.findByText('Pricing question'));

    expect(await screen.findByText('Message detail')).toBeInTheDocument();
    expect(screen.getByText('Hi, I would like to know more.')).toBeInTheDocument();
  });

  it('opens the drawer for the message id carried in a ?messageId= deep link', async () => {
    renderInboxPage('/inbox?messageId=m-1');

    expect(await screen.findByText('Message detail')).toBeInTheDocument();
  });

  // This used to assert a silent no-op: the page navigated, no drawer opened,
  // and nothing explained why. There is no fetch-by-id endpoint to fall back
  // on, so the deep link has to say so rather than dead-end.
  it('explains the dead end when the deep-linked id is not in the loaded page', async () => {
    renderInboxPage('/inbox?messageId=does-not-exist');

    await screen.findByText('Pricing question');

    expect(screen.queryByText('Message detail')).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(
      /isn’t in the messages loaded here/,
    );
  });

  it('offers to clear the status filter when one is hiding the deep-linked message', async () => {
    renderInboxPage('/inbox?messageId=does-not-exist');

    await screen.findByText('Pricing question');

    // No filter active yet, so no "show all" escape hatch is needed.
    expect(screen.queryByRole('button', { name: 'Show all statuses' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('RESOLVED'));

    expect(await screen.findByRole('button', { name: 'Show all statuses' })).toBeInTheDocument();
  });

  it('dismisses the notice and does not bring it back', async () => {
    renderInboxPage('/inbox?messageId=does-not-exist');

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('opens the drawer without any notice once a later page contains the message', async () => {
    vi.mocked(contactApi.fetchContactMessages).mockResolvedValueOnce({
      items: OPEN_PAGE.items,
      nextCursor: 'm-1',
    });
    vi.mocked(contactApi.fetchContactMessages).mockResolvedValueOnce({
      items: TWO_MESSAGE_PAGE.items.slice(1),
      nextCursor: null,
    });

    renderInboxPage('/inbox?messageId=m-2');

    fireEvent.click(await screen.findByRole('button', { name: 'Load older messages' }));

    expect(await screen.findByText('I would like a refund.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('swaps to the second message when ?messageId= changes without remounting', async () => {
    vi.mocked(contactApi.fetchContactMessages).mockResolvedValue(TWO_MESSAGE_PAGE);

    renderInboxPageWithNavigation('/inbox?messageId=m-1');

    // Both messages' subjects also render as table rows, so assert on the
    // drawer-only body text to unambiguously prove which message is open.
    expect(await screen.findByText('Hi, I would like to know more.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'go to second message' }));

    await waitFor(() => expect(screen.getByText('I would like a refund.')).toBeInTheDocument());
    expect(screen.queryByText('Hi, I would like to know more.')).not.toBeInTheDocument();
  });
});
