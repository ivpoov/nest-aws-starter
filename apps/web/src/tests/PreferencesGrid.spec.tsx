import type { NotificationPreferenceResponseInterface } from '@nest-aws-starter/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PreferencesGrid } from '../components/Notifications/PreferencesGrid';

const PREFERENCES: NotificationPreferenceResponseInterface[] = [
  {
    type: 'PASSWORD_CHANGED' as NotificationPreferenceResponseInterface['type'],
    channel: 'IN_APP' as NotificationPreferenceResponseInterface['channel'],
    enabled: true,
    isEditable: false,
  },
  {
    type: 'PASSWORD_CHANGED' as NotificationPreferenceResponseInterface['type'],
    channel: 'EMAIL' as NotificationPreferenceResponseInterface['channel'],
    enabled: true,
    isEditable: true,
  },
];

describe('PreferencesGrid', () => {
  it('renders the IN_APP cell as a fixed, non-interactive hint', () => {
    render(<PreferencesGrid preferences={PREFERENCES} pendingKey={null} onToggle={vi.fn()} />);

    expect(screen.getByText('Always on')).toBeInTheDocument();
    expect(screen.queryAllByRole('switch')).toHaveLength(1);
  });

  it('calls onToggle with the flipped value for an EMAIL toggle', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(<PreferencesGrid preferences={PREFERENCES} pendingKey={null} onToggle={onToggle} />);

    await user.click(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalledWith('PASSWORD_CHANGED', 'EMAIL', false);
  });

  it('disables the pending cell', () => {
    render(
      <PreferencesGrid
        preferences={PREFERENCES}
        pendingKey="PASSWORD_CHANGED:EMAIL"
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
