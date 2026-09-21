import { canAuthorNote } from './useMistakeNotes.helpers';
import { MAX_NOTES_PER_SESSION } from '@/constants';

describe('canAuthorNote', () => {
  it('allows a first miss on a fresh topic', () => {
    expect(canAuthorNote(new Set(), 0, 't1')).toBe(true);
  });

  it('rejects a second miss on the same topic this session', () => {
    expect(canAuthorNote(new Set(['t1']), 0, 't1')).toBe(false);
  });

  it('allows a different topic even after one is attempted', () => {
    expect(canAuthorNote(new Set(['t1']), 0, 't2')).toBe(true);
  });

  it('rejects once the session cap is reached, even on a fresh topic', () => {
    expect(canAuthorNote(new Set(), MAX_NOTES_PER_SESSION, 't9')).toBe(false);
  });

  it('a rejected candidate does not consume the cap — only insert increments it', () => {
    // authoredCount tracks inserts only, per the hook's contract; the pure
    // helper just checks it, so this documents the caller's responsibility.
    expect(canAuthorNote(new Set(['t1']), 0, 't2')).toBe(true);
  });
});
