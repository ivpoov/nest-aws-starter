import {
  type ContactMessageListResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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

describe('InboxPage', () => {
  beforeEach(() => {
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

  it('does not open a drawer when the deep-linked id is not in the loaded page', async () => {
    renderInboxPage('/inbox?messageId=does-not-exist');

    await screen.findByText('Pricing question');

    expect(screen.queryByText('Message detail')).not.toBeInTheDocument();
  });
});
