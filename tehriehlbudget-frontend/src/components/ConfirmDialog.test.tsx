import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  function setup(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const utils = render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete thing?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        {...overrides}
      />,
    );
    return { onOpenChange, onConfirm, ...utils };
  }

  it('renders the title, description, and labels', () => {
    setup();
    expect(screen.getByText('Delete thing?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('calls onConfirm and closes on confirm click', async () => {
    const { onConfirm, onOpenChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) on cancel click without invoking onConfirm', () => {
    const { onConfirm, onOpenChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the dialog open if onConfirm rejects', async () => {
    const err = new Error('boom');
    const onConfirm = vi.fn().mockRejectedValue(err);
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="t"
        description="d"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('disables the confirm button while the action is pending', async () => {
    let resolve: () => void = () => {};
    const onConfirm = vi.fn(
      () => new Promise<void>((r) => (resolve = r)),
    );
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="t"
        description="d"
        onConfirm={onConfirm}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(confirmBtn.hasAttribute('disabled')).toBe(true));
    resolve();
  });

  it('renders the destructive variant on the confirm button when flagged', () => {
    setup({ destructive: true });
    const btn = screen.getByRole('button', { name: 'Delete' });
    // The destructive variant is indicated by a text-destructive utility class.
    expect(btn.className).toMatch(/destructive/);
  });
});
