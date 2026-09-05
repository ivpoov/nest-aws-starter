import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Brand } from '../components/Brand/Brand';

describe('Brand', () => {
  it('renders the admin product name', async () => {
    const { ADMIN_PRODUCT_NAME } = await import('../constants/product.constants');

    render(<Brand />);

    expect(screen.getByText(ADMIN_PRODUCT_NAME)).toBeInTheDocument();
  });

  // Same source in both places: the sidebar and the login screen cannot end up
  // disagreeing about what the product is called.
  it('renders the same name in its compact sidebar form', async () => {
    const { ADMIN_PRODUCT_NAME } = await import('../constants/product.constants');

    render(<Brand isCompact />);

    expect(screen.getByText(ADMIN_PRODUCT_NAME)).toBeInTheDocument();
  });

  // Derived, never a second variable — that is what stops the two apps drifting.
  it('derives the admin name from the shared product name', async () => {
    const { PRODUCT_NAME, ADMIN_PRODUCT_NAME } = await import('../constants/product.constants');

    expect(ADMIN_PRODUCT_NAME).toBe(`${PRODUCT_NAME} Admin`);
  });
});
