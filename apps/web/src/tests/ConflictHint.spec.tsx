import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConflictHint } from '../components/Methods/ConflictHint';

describe('ConflictHint', () => {
  it('renders the providers from the conflict meta', () => {
    render(
      <ConflictHint
        error={{
          statusCode: 409,
          code: 'AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT',
          details: 'This email already belongs to another account',
          meta: { providers: ['GOOGLE', 'DISCORD'] },
          timestamp: '',
          path: '',
        }}
      />,
    );

    expect(screen.getByText('This email already belongs to another account')).toBeInTheDocument();
    expect(screen.getByText(/GOOGLE, DISCORD/)).toBeInTheDocument();
  });

  it('renders without providers when the meta is absent', () => {
    render(
      <ConflictHint
        error={{
          statusCode: 409,
          code: 'AUTH_METHOD_ALREADY_LINKED',
          details: 'Already linked',
          meta: undefined,
          timestamp: '',
          path: '',
        }}
      />,
    );

    expect(screen.getByText('Already linked')).toBeInTheDocument();
    expect(screen.queryByText(/signs in with/)).not.toBeInTheDocument();
  });
});
