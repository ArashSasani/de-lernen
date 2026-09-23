import {
  BOXES,
  MAX_SYNC_ENTRIES,
  MAX_SYNC_KEY_LEN,
  SYNC_TIMESTAMP_SLACK_MS,
} from '@/constants';
import type { ProgressMap, WordProgress } from '@/types';
import type {
  DictationProgressMap,
  DictationWordProgress,
} from '@/types/dictation';
import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
} from '@/types/grammar-quiz';
import { INTERVALS } from './leitner';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// nextDue is legitimately in the future — a box-5 card schedules 30 days
// out — so it gets the longest interval as headroom, not the past bound.
const MAX_NEXT_DUE_AHEAD_MS =
  INTERVALS[5] * MS_PER_DAY + SYNC_TIMESTAMP_SLACK_MS;

const BOX_VALUES: readonly number[] = BOXES;

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBoundedInt(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

export function isTimestamp(
  value: unknown,
  maxAllowed: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= maxAllowed
  );
}

// The clock-skew guard every track shares: `lastReviewed` / `lastSeen` /
// `createdAt` all describe something that already happened.
export function isPastTimestamp(
  value: unknown,
  now: number = Date.now(),
): value is number {
  return isTimestamp(value, now + SYNC_TIMESTAMP_SLACK_MS);
}

// Unknown keys are rejected rather than stripped: there is no strip step
// between here and KV, so anything allowed through is persisted for good.
function hasOnlyKeys(
  entry: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(entry).every((k) => allowed.includes(k));
}

export type EntryParser<T> = (
  entry: Record<string, unknown>,
  now: number,
) => T | null;

// The container check the three progress tracks share. Rejects the whole
// body on the first bad entry — safe because a non-2xx leaves the client's
// dirty set intact (useProgressSync only clears it on a response), so the
// entries retry on the next flush instead of being lost.
export function parseEntryMap<T>(
  body: unknown,
  parseEntry: EntryParser<T>,
  now: number = Date.now(),
): Record<string, T> | null {
  if (!isPlainObject(body)) return null;

  const keys = Object.keys(body);
  if (keys.length > MAX_SYNC_ENTRIES) return null;

  const out: Record<string, T> = {};
  for (const key of keys) {
    // A `__proto__` key assigns through Object.prototype's setter instead of
    // becoming an own property, so the entry would vanish on serialise.
    if (!key || key.length > MAX_SYNC_KEY_LEN || key === '__proto__') {
      return null;
    }
    const value = body[key];
    if (!isPlainObject(value)) return null;
    const parsed = parseEntry(value, now);
    if (parsed === null) return null;
    out[key] = parsed;
  }
  return out;
}

const PROGRESS_KEYS = ['box', 'lastReviewed', 'nextDue'] as const;

export function parseProgressMap(
  body: unknown,
  now: number = Date.now(),
): ProgressMap | null {
  return parseEntryMap<WordProgress>(
    body,
    (e, at) => {
      if (!hasOnlyKeys(e, PROGRESS_KEYS)) return null;
      if (typeof e.box !== 'number' || !BOX_VALUES.includes(e.box)) return null;
      if (!isPastTimestamp(e.lastReviewed, at)) return null;
      if (!isTimestamp(e.nextDue, at + MAX_NEXT_DUE_AHEAD_MS)) return null;
      return {
        box: e.box as WordProgress['box'],
        lastReviewed: e.lastReviewed,
        nextDue: e.nextDue,
      };
    },
    now,
  );
}

// attempts/correct/streak are the same three counters in both attempt-based
// tracks; neither derived counter can exceed the attempts behind it.
function parseCounters(
  e: Record<string, unknown>,
): { attempts: number; correct: number; streak: number } | null {
  if (!isBoundedInt(e.attempts, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (!isBoundedInt(e.correct, 0, e.attempts)) return null;
  if (!isBoundedInt(e.streak, 0, e.attempts)) return null;
  return { attempts: e.attempts, correct: e.correct, streak: e.streak };
}

const DICTATION_KEYS = [
  'attempts',
  'correct',
  'streak',
  'lastSeen',
  'starred',
  'starredAt',
] as const;

export function parseDictationMap(
  body: unknown,
  now: number = Date.now(),
): DictationProgressMap | null {
  return parseEntryMap<DictationWordProgress>(
    body,
    (e, at) => {
      if (!hasOnlyKeys(e, DICTATION_KEYS)) return null;
      const counters = parseCounters(e);
      if (!counters) return null;
      if (!isPastTimestamp(e.lastSeen, at)) return null;
      if (e.starred !== undefined && typeof e.starred !== 'boolean') {
        return null;
      }
      // Skew-guarded like every other timestamp: `starredAt` decides which
      // device's bookmark wins, so a future one would pin the star forever.
      if (e.starredAt !== undefined && !isPastTimestamp(e.starredAt, at)) {
        return null;
      }
      return {
        ...counters,
        lastSeen: e.lastSeen,
        ...(e.starred !== undefined ? { starred: e.starred } : {}),
        ...(e.starredAt !== undefined ? { starredAt: e.starredAt } : {}),
      };
    },
    now,
  );
}

const GRAMMAR_QUIZ_KEYS = [
  'attempts',
  'correct',
  'streak',
  'lastSeen',
] as const;

export function parseGrammarQuizMap(
  body: unknown,
  now: number = Date.now(),
): GrammarQuizProgressMap | null {
  return parseEntryMap<GrammarQuizTopicProgress>(
    body,
    (e, at) => {
      if (!hasOnlyKeys(e, GRAMMAR_QUIZ_KEYS)) return null;
      const counters = parseCounters(e);
      if (!counters) return null;
      if (!isPastTimestamp(e.lastSeen, at)) return null;
      return { ...counters, lastSeen: e.lastSeen };
    },
    now,
  );
}
