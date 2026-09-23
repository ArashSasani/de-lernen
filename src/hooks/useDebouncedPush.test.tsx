/**
 * @jest-environment jsdom
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { SYNC_DEBOUNCE_MS } from '@/lib/sync';
import { useDebouncedPush } from './useDebouncedPush';

// The lifecycle all four synced tracks share. The durability contract it
// owns: debounce normal writes, flush with keepalive when the page hides,
// and clear only the ids a confirmed push was handed.

jest.mock('../lib/sync', () => ({ SYNC_DEBOUNCE_MS: 2000 }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

function setup(confirm = true) {
  const push = jest.fn<
    Promise<boolean>,
    [ReadonlySet<string>, { keepalive?: boolean }]
  >(async () => confirm);
  const view = renderHook(() => useDebouncedPush(push));
  return { push, ...view };
}

describe('useDebouncedPush', () => {
  it('debounces a burst of writes into one push', async () => {
    const { push, result } = setup();
    act(() => {
      result.current.markDirty('a');
      result.current.markDirty('b');
    });
    expect(push).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(SYNC_DEBOUNCE_MS);
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect([...push.mock.calls[0][0]]).toEqual(['a', 'b']);
    expect(push.mock.calls[0][1]).toEqual({});
  });

  it('flushes with keepalive when the page is hidden', async () => {
    const { push, result } = setup();
    act(() => result.current.markDirty('a'));
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(push).toHaveBeenCalledWith(new Set(['a']), { keepalive: true });
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('flushes on pagehide and on unmount', async () => {
    const { push, result, unmount } = setup();
    act(() => result.current.markDirty('a'));
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(push).toHaveBeenCalledTimes(1);

    act(() => result.current.markDirty('b'));
    await act(async () => unmount());
    expect(push).toHaveBeenCalledTimes(2);
    expect([...push.mock.calls[1][0]]).toEqual(['b']);
  });

  it('keeps ids dirty when the push is not confirmed', async () => {
    const { push, result } = setup(false);
    act(() => result.current.markDirty('a'));
    await act(async () => result.current.flush());
    await act(async () => result.current.flush());
    expect(push).toHaveBeenCalledTimes(2);
    expect([...push.mock.calls[1][0]]).toEqual(['a']);
  });

  it('clears confirmed ids, so an idle flush sends nothing', async () => {
    const { push, result } = setup(true);
    act(() => result.current.markDirty('a'));
    await act(async () => result.current.flush());
    await act(async () => result.current.flush());
    expect(push).toHaveBeenCalledTimes(1);
  });
});
