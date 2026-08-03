import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as contactApi from '../apis/contact';
import { ContactPage } from '../pages/ContactPage';

vi.mock('../apis/contact');

function renderPage(): void {
  render(
    <MemoryRouter>
      <ContactPage />
    </MemoryRouter>,
  );
}

function fillRequiredFields(): void {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jane Doe' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Pricing question' } });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Hi, I would like to know more.' },
  });
}

describe('ContactPage', () => {
  beforeEach(() => {
    vi.mocked(contactApi.submitContact).mockResolvedValue(undefined);
  });

  it('disables submit until every required field is filled', () => {
    renderPage();

    expect(screen.getByText('Send message')).toBeDisabled();

    fillRequiredFields();

    expect(screen.getByText('Send message')).not.toBeDisabled();
  });

  it('submits the payload with the honeypot untouched and shows the success state', async () => {
    renderPage();
    fillRequiredFields();

    fireEvent.click(screen.getByText('Send message'));

    await waitFor((): void => {
      expect(contactApi.submitContact).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Pricing question',
        body: 'Hi, I would like to know more.',
        website: '',
      });
    });

    expect(await screen.findByText(/we'll get back to you/)).toBeInTheDocument();
  });

  it('renders the 429 throttle message from the error envelope', async () => {
    vi.mocked(contactApi.submitContact).mockRejectedValue({
      statusCode: 429,
      code: 'THROTTLED',
      details: 'Too many requests, try again later',
      meta: undefined,
      timestamp: '',
      path: '/contact',
    });

    renderPage();
    fillRequiredFields();

    fireEvent.click(screen.getByText('Send message'));

    expect(await screen.findByText('Too many requests, try again later')).toBeInTheDocument();
  });
});
