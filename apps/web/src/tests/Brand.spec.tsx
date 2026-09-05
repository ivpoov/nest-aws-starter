import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Brand } from '../components/Brand/Brand';

// The point of the slot is that a fork renames the product in one place, so
// what is worth asserting is that the name on screen comes from the shared
// constant rather than from a literal in the page.
describe('Brand', () => {
  it('renders the product name', async () => {
    const { PRODUCT_NAME } = await import('../constants/product.constants');

    render(<Brand />);

    expect(screen.getByText(PRODUCT_NAME)).toBeInTheDocument();
  });

  it('falls back to a real name when no product name is configured', async () => {
    const { PRODUCT_NAME } = await import('../constants/product.constants');

    // A fresh clone has no .env. Rendering an unsubstituted placeholder would
    // be worse than shipping a name somebody has to change.
    expect(PRODUCT_NAME).not.toContain('%');
    expect(PRODUCT_NAME.trim().length).toBeGreaterThan(0);
  });
});
