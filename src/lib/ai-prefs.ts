'use client';

import { LEVELS } from '@/constants';
import type { Level } from '@/types';

const AI_ENABLED_KEY = 'ai_enabled';
const LEARNER_LEVEL_KEY = 'learner_level';
const JUDGE_ENABLED_KEY = 'judge_enabled';

// Per-device prefs (localStorage), never synced to KV/IndexedDB.
export function isAiEnabled(): boolean {
  try {
    return localStorage.getItem(AI_ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setAiEnabled(on: boolean): void {
  try {
    localStorage.setItem(AI_ENABLED_KEY, on ? '1' : '0');
  } catch {
    // ignore
  }
}

export function getLearnerLevel(): Level {
  try {
    const v = localStorage.getItem(LEARNER_LEVEL_KEY);
    return (LEVELS as readonly string[]).includes(v ?? '')
      ? (v as Level)
      : 'a1';
  } catch {
    return 'a1';
  }
}

export function setLearnerLevel(level: Level): void {
  try {
    localStorage.setItem(LEARNER_LEVEL_KEY, level);
  } catch {
    // ignore
  }
}

// Default OFF, unlike the AI toggle (`!== '0'`): the judge is an extra model
// call per authored note, and the pure gate alone already covers the common
// cases — this is an opt-in for anyone who wants the extra verification.
export function isJudgeEnabled(): boolean {
  try {
    return localStorage.getItem(JUDGE_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setJudgeEnabled(on: boolean): void {
  try {
    localStorage.setItem(JUDGE_ENABLED_KEY, on ? '1' : '0');
  } catch {
    // ignore
  }
}
