import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BillingSuccessPage } from '../pages/BillingSuccessPage';

describe('BillingSuccessPage', () => {
  it('never claims the subscription is already active — activation is async', () => {
    render(
      <MemoryRouter>
        <BillingSuccessPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/activates as soon as the provider confirms/i)).toBeInTheDocument();
    expect(screen.queryByText(/your subscription is active/i)).not.toBeInTheDocument();
  });

  it('links to the billing settings page', () => {
    render(
      <MemoryRouter>
        <BillingSuccessPage />
      </MemoryRouter>,
    );

    const link: HTMLAnchorElement = screen.getByRole('link', { name: 'Go to billing settings' });

    expect(link.getAttribute('href')).toBe('/settings/billing');
  });
});
