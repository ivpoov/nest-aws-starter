import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../components/ui/Modal';

describe('Modal', () => {
  it('renders the title and children', () => {
    render(
      <Modal title="Test modal" onClose={vi.fn()}>
        <p>Modal body</p>
      </Modal>,
    );

    expect(screen.getByText('Test modal')).toBeInTheDocument();
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Modal body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Modal body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByLabelText('Close modal'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the dialog content is clicked', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Modal body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText('Modal body'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the Close button is clicked', () => {
    const onClose = vi.fn();

    render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Modal body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
