/**
 * @jest-environment jsdom
 */
import {
  isAiEnabled,
  setAiEnabled,
  getLearnerLevel,
  setLearnerLevel,
} from '@/lib/ai-prefs';

beforeEach(() => {
  localStorage.clear();
});

describe('isAiEnabled / setAiEnabled', () => {
  it('defaults to enabled', () => {
    expect(isAiEnabled()).toBe(true);
  });

  it('round-trips a disabled preference', () => {
    setAiEnabled(false);
    expect(isAiEnabled()).toBe(false);
    setAiEnabled(true);
    expect(isAiEnabled()).toBe(true);
  });
});

describe('getLearnerLevel / setLearnerLevel', () => {
  it('defaults to a1', () => {
    expect(getLearnerLevel()).toBe('a1');
  });

  it('round-trips a chosen level', () => {
    setLearnerLevel('b1');
    expect(getLearnerLevel()).toBe('b1');
  });

  it('falls back to a1 on a corrupted value', () => {
    localStorage.setItem('learner_level', 'not-a-level');
    expect(getLearnerLevel()).toBe('a1');
  });
});
