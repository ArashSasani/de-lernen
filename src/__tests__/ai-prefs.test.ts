/**
 * @jest-environment jsdom
 */
import {
  isAiEnabled,
  setAiEnabled,
  getLearnerLevel,
  setLearnerLevel,
  isJudgeEnabled,
  setJudgeEnabled,
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

describe('isJudgeEnabled / setJudgeEnabled', () => {
  it('defaults to disabled', () => {
    expect(isJudgeEnabled()).toBe(false);
  });

  it('round-trips an enabled preference', () => {
    setJudgeEnabled(true);
    expect(isJudgeEnabled()).toBe(true);
    setJudgeEnabled(false);
    expect(isJudgeEnabled()).toBe(false);
  });

  it('treats a corrupted value as disabled', () => {
    localStorage.setItem('judge_enabled', 'yes');
    expect(isJudgeEnabled()).toBe(false);
  });
});
