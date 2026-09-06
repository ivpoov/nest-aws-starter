import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '../components/ui/Input';

// The toggle exists because a password you cannot see is a password you cannot
// debug. A pasted value carrying a stray tab or trailing space looks identical
// to a correct one behind dots, and the only feedback is "invalid credentials"
// — which reads as "this account does not exist".
describe('Input', () => {
  it('masks a password until it is revealed', () => {
    render(<Input label="Password" type="password" value="hunter2" onChange={vi.fn()} />);

    const field: HTMLInputElement = screen.getByLabelText('Password') as HTMLInputElement;

    expect(field.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('text');
  });

  it('hides the password again', () => {
    render(<Input label="Password" type="password" value="hunter2" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));

    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('password');
  });

  // Inside a <form> a bare <button> submits it. On a login page that means the
  // click meant to reveal the password instead attempts a sign-in with whatever
  // has been typed so far — and on an account with a lockout policy, repeatedly.
  it('does not submit the form it sits in', () => {
    const onSubmit = vi.fn((event: React.FormEvent): void => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <Input label="Password" type="password" value="hunter2" onChange={vi.fn()} />
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers no toggle on a field that is not a password', () => {
    render(<Input label="Email" type="email" value="a@b.c" onChange={vi.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reports its error to assistive technology', () => {
    render(
      <Input label="Password" type="password" value="" onChange={vi.fn()} error="Too short" />,
    );

    const field: HTMLInputElement = screen.getByLabelText('Password') as HTMLInputElement;

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(screen.getByText('Too short').id);
  });

  // The case that actually cost an afternoon: a password copied out of the
  // README carrying a trailing tab. Revealed or masked, that character renders
  // as nothing, so the field looks correct and the login fails with what reads
  // like "no such account".
  it('warns when a pasted password carries trailing whitespace', () => {
    render(<Input label="Password" type="password" value={'DemoAdmin123!\t'} onChange={vi.fn()} />);

    expect(screen.getByText(/stray characters/)).toBeInTheDocument();
  });

  it('says nothing about whitespace for a clean password', () => {
    render(<Input label="Password" type="password" value="DemoAdmin123!" onChange={vi.fn()} />);

    expect(screen.queryByText(/stray characters/)).toBeNull();
  });

  // An empty field is not a mistake yet; warning there would nag every visitor
  // before they have typed anything.
  it('says nothing about whitespace while the field is empty', () => {
    render(<Input label="Password" type="password" value="" onChange={vi.fn()} />);

    expect(screen.queryByText(/stray characters/)).toBeNull();
  });
});
