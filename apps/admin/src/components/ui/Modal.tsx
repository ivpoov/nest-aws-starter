import type { ReactElement, ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalPropsInterface {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

// Minimal modal primitive — esc + backdrop close, no focus trap. The
// backdrop is a real <button> (keyboard-accessible by default, no
// onKeyDown pairing needed) positioned under the dialog rather than as its
// parent, so a click inside the dialog never needs stopPropagation — it
// simply isn't a descendant of the backdrop button. Styled with the same
// surface/edge tokens as the drawer components; the backdrop uses the
// theme-invariant `overlay` token (a dimming layer, not a surface).
export function Modal({ title, onClose, children }: ModalPropsInterface): ReactElement {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);

    return (): void => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-overlay"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-xl border border-edge bg-surface-raised p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-content-muted hover:text-content"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
