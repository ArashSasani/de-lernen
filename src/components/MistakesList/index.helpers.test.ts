import { relativeTime, sortByRecency, SOURCE_LABELS } from './index.helpers';
import type { MistakeRecord } from '@/types/mistakes';

describe('relativeTime', () => {
  const now = 1700000000000;

  it('reports "just now" under a minute', () => {
    expect(relativeTime(now - 30_000, now)).toBe('just now');
  });

  it('reports minutes under an hour', () => {
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago');
  });

  it('reports hours under a day', () => {
    expect(relativeTime(now - 3 * 60 * 60_000, now)).toBe('3h ago');
  });

  it('reports days beyond that', () => {
    expect(relativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('2d ago');
  });

  it('never goes negative for a future timestamp', () => {
    expect(relativeTime(now + 60_000, now)).toBe('just now');
  });
});

describe('sortByRecency', () => {
  const record = (id: string, createdAt: number): MistakeRecord => ({
    id,
    source: 'grammar-quiz',
    text: id,
    createdAt,
  });

  it('sorts newest first', () => {
    const sorted = sortByRecency([record('old', 1), record('new', 2)]);
    expect(sorted.map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('does not mutate the input array', () => {
    const input = [record('old', 1), record('new', 2)];
    sortByRecency(input);
    expect(input.map((r) => r.id)).toEqual(['old', 'new']);
  });
});

describe('SOURCE_LABELS', () => {
  it('has a label for every MistakeSource', () => {
    const sources: MistakeRecord['source'][] = [
      'grammar-quiz',
      'flashcard',
      'dictation',
      'grammar-quiz',
    ];
    for (const source of sources) {
      expect(SOURCE_LABELS[source]).toBeTruthy();
    }
  });
});
