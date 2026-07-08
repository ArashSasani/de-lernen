import {
  defaultProgress,
  isDue,
  onGood,
  onMiss,
  onEasy,
  boxCounts,
  dueCount,
  INTERVALS,
} from '@/lib/leitner';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

describe('defaultProgress', () => {
  it('starts in box 1 and is due immediately', () => {
    const p = defaultProgress();
    expect(p.box).toBe(1);
    expect(p.nextDue).toBe(0);
    expect(isDue(p, now)).toBe(true);
  });
});

describe('isDue', () => {
  it('returns true when nextDue <= now', () => {
    expect(isDue({ box: 1, lastReviewed: now, nextDue: now - 1 }, now)).toBe(
      true,
    );
    expect(isDue({ box: 1, lastReviewed: now, nextDue: now }, now)).toBe(true);
  });

  it('returns false when nextDue > now', () => {
    expect(isDue({ box: 1, lastReviewed: now, nextDue: now + 1 }, now)).toBe(
      false,
    );
  });
});

describe('onGood', () => {
  it('advances box 1 → 2 and schedules by interval', () => {
    const p = onGood(defaultProgress(), now);
    expect(p.box).toBe(2);
    expect(p.lastReviewed).toBe(now);
    expect(p.nextDue).toBeGreaterThanOrEqual(now + INTERVALS[2] * DAY - 1000);
    expect(isDue(p, now)).toBe(false);
  });

  it('advances box 2 → 3', () => {
    const p = onGood({ box: 2, lastReviewed: now, nextDue: now - 1 }, now);
    expect(p.box).toBe(3);
  });

  it('advances box 4 → 5', () => {
    const p = onGood({ box: 4, lastReviewed: now, nextDue: now - 1 }, now);
    expect(p.box).toBe(5);
  });

  it('caps at box 5', () => {
    const p = onGood({ box: 5, lastReviewed: now, nextDue: now - 1 }, now);
    expect(p.box).toBe(5);
    expect(p.nextDue).toBeGreaterThanOrEqual(now + INTERVALS[5] * DAY - 1000);
  });
});

describe('onMiss', () => {
  it('resets any box to 1', () => {
    expect(
      onMiss({ box: 3, lastReviewed: now, nextDue: now - 1 }, now).box,
    ).toBe(1);
    expect(
      onMiss({ box: 5, lastReviewed: now, nextDue: now - 1 }, now).box,
    ).toBe(1);
  });

  it('schedules by box 1 interval', () => {
    const p = onMiss({ box: 4, lastReviewed: now, nextDue: now - 1 }, now);
    expect(p.nextDue).toBeGreaterThanOrEqual(now + INTERVALS[1] * DAY - 1000);
  });
});

describe('onEasy', () => {
  it('jumps any box to 5', () => {
    expect(onEasy({ box: 1, lastReviewed: now, nextDue: 0 }, now).box).toBe(5);
    expect(onEasy({ box: 3, lastReviewed: now, nextDue: 0 }, now).box).toBe(5);
  });

  it('schedules by box 5 interval', () => {
    const p = onEasy(defaultProgress(), now);
    expect(p.nextDue).toBeGreaterThanOrEqual(now + INTERVALS[5] * DAY - 1000);
  });
});

describe('boxCounts', () => {
  it('counts entries per box', () => {
    const counts = boxCounts({
      a: { box: 1, lastReviewed: now, nextDue: now },
      b: { box: 2, lastReviewed: now, nextDue: now },
      c: { box: 1, lastReviewed: now, nextDue: now },
    });
    expect(counts[1]).toBe(2);
    expect(counts[2]).toBe(1);
    expect(counts[3]).toBe(0);
  });

  it('returns zeros for empty progress', () => {
    const counts = boxCounts({});
    expect(counts).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });
});

describe('dueCount', () => {
  it('counts only entries with nextDue <= now', () => {
    const count = dueCount(
      {
        a: { box: 1, lastReviewed: now, nextDue: now - 1 },
        b: { box: 2, lastReviewed: now, nextDue: now + DAY },
        c: { box: 3, lastReviewed: now, nextDue: now - 1 },
      },
      now,
    );
    expect(count).toBe(2);
  });
});
