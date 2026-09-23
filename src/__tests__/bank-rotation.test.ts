/**
 * @jest-environment jsdom
 */
import { getServedAt, markServed } from '@/lib/bank-rotation';
import { generateQuestionsForTopic, bankPoolSize } from '@/lib/grammar-quiz';
import { grammarBank } from '@/lib/dataset';
import { BANK_ROTATION_MAX } from '@/constants';

beforeEach(() => localStorage.clear());

describe('bank rotation store', () => {
  it('round-trips served timestamps', () => {
    markServed(['a', 'b'], 100);
    expect(getServedAt()).toEqual(
      new Map([
        ['a', 100],
        ['b', 100],
      ]),
    );
  });

  it('falls back to empty on a corrupted value', () => {
    localStorage.setItem('bank_served_at', '{not json');
    expect(getServedAt().size).toBe(0);
  });

  it('ignores non-numeric timestamps', () => {
    localStorage.setItem('bank_served_at', JSON.stringify({ a: 'x', b: 5 }));
    expect(getServedAt()).toEqual(new Map([['b', 5]]));
  });

  it('prunes to the most recent entries', () => {
    const ids = Array.from(
      { length: BANK_ROTATION_MAX + 5 },
      (_, i) => `q${i}`,
    );
    ids.forEach((id, i) => markServed([id], i));
    const served = getServedAt();
    expect(served.size).toBe(BANK_ROTATION_MAX);
    expect(served.has('q0')).toBe(false);
    expect(served.has(`q${ids.length - 1}`)).toBe(true);
  });
});

describe('generateQuestionsForTopic — rotation order', () => {
  const topicId = grammarBank[0].topicId;

  it('serves never-served items before recently served ones', () => {
    const pool = generateQuestionsForTopic(topicId, 1000);
    const [recent, ...rest] = pool;
    const servedAt = new Map([[recent.id, 999]]);
    const picked = generateQuestionsForTopic(
      topicId,
      rest.length,
      undefined,
      servedAt,
    );
    expect(picked.map((q) => q.id)).not.toContain(recent.id);
  });

  it('works through the whole pool across consecutive sessions', () => {
    const size = bankPoolSize(topicId);
    const servedAt = new Map<string, number>();
    const seen = new Set<string>();
    // Two half-sized sessions must between them cover the pool.
    for (let s = 1; s <= 2; s++) {
      const picked = generateQuestionsForTopic(
        topicId,
        Math.ceil(size / 2),
        undefined,
        servedAt,
      );
      for (const q of picked) {
        seen.add(q.id);
        servedAt.set(q.id, s);
      }
    }
    expect(seen.size).toBe(size);
  });

  it('bankPoolSize counts the topic’s items', () => {
    expect(bankPoolSize(topicId)).toBe(
      grammarBank.filter((q) => q.topicId === topicId).length,
    );
    expect(bankPoolSize('no-such-topic')).toBe(0);
  });
});
