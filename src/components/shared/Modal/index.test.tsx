/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Modal from './index';

// The helper tests cover focusableElements(); these cover the behaviour that
// only exists once the component is mounted — focus handoff, the Escape and
// Tab key handlers, and the body scroll lock, all of which live in an effect.

afterEach(cleanup);

function open(onClose = jest.fn()) {
  const result = render(
    <Modal open onClose={onClose} title="Tägliche Lektüre">
      <button>first</button>
      <button>last</button>
    </Modal>,
  );
  return { onClose, ...result };
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={jest.fn()} title="Hidden">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('exposes itself as a labelled modal dialog', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Tägliche Lektüre');
  });

  it('moves focus to the close button on open', () => {
    open();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close' }),
    );
  });

  it('closes on Escape', () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click but not on a click inside the panel', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByText('first'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it on close', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = open();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('wraps Tab from the last focusable element back to the first', () => {
    open();
    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByText('last');
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
  });

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    open();
    screen.getByRole('button', { name: 'Close' }).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('restores focus to whatever opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = open();
    expect(document.activeElement).not.toBe(opener);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
