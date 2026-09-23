import {
  isPastTimestamp,
  isPlainObject,
  parseDictationMap,
  parseGrammarQuizMap,
  parseProgressMap,
} from '@/lib/validate-sync';
import {
  MAX_SYNC_ENTRIES,
  MAX_SYNC_KEY_LEN,
  SYNC_TIMESTAMP_SLACK_MS,
} from '@/constants';
import { INTERVALS } from '@/lib/leitner';

const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

const progressEntry = (overrides: Record<string, unknown> = {}) => ({
  box: 3,
  lastReviewed: NOW - DAY,
  nextDue: NOW + DAY,
  ...overrides,
});

const dictationEntry = (overrides: Record<string, unknown> = {}) => ({
  attempts: 4,
  correct: 3,
  streak: 2,
  lastSeen: NOW - DAY,
  ...overrides,
});

const quizEntry = (overrides: Record<string, unknown> = {}) => ({
  attempts: 4,
  correct: 3,
  streak: 2,
  lastSeen: NOW - DAY,
  ...overrides,
});

describe('isPlainObject', () => {
  it.each([
    ['object', {}, true],
    ['array', [], false],
    ['null', null, false],
    ['string', 'abc', false],
    ['number', 5, false],
    ['boolean', true, false],
  ])('%s → %s', (_label, value, expected) => {
    expect(isPlainObject(value)).toBe(expected);
  });
});

describe('isPastTimestamp', () => {
  it('accepts a past timestamp and zero', () => {
    expect(isPastTimestamp(NOW - DAY, NOW)).toBe(true);
    expect(isPastTimestamp(0, NOW)).toBe(true);
  });

  it('accepts a small future skew, inside the slack', () => {
    expect(isPastTimestamp(NOW + SYNC_TIMESTAMP_SLACK_MS, NOW)).toBe(true);
  });

  it('rejects a timestamp past the slack — a skewed device clock', () => {
    expect(isPastTimestamp(NOW + SYNC_TIMESTAMP_SLACK_MS + 1, NOW)).toBe(false);
    expect(isPastTimestamp(8.64e15, NOW)).toBe(false);
  });

  it.each([
    ['negative', -1],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['string', '123'],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isPastTimestamp(value, NOW)).toBe(false);
  });
});

describe('parseProgressMap', () => {
  it('accepts a well-formed map and returns it', () => {
    const body = { abend: progressEntry() };
    expect(parseProgressMap(body, NOW)).toEqual(body);
  });

  it('accepts an empty map', () => {
    expect(parseProgressMap({}, NOW)).toEqual({});
  });

  it.each([
    ['null', null],
    ['a string', 'abc'],
    ['an array', [progressEntry()]],
    ['a number', 5],
    ['a boolean', true],
  ])('rejects %s as a body', (_label, body) => {
    expect(parseProgressMap(body, NOW)).toBeNull();
  });

  it('rejects a non-object entry value', () => {
    expect(parseProgressMap({ abend: 'garbage' }, NOW)).toBeNull();
  });

  it.each([
    ['box 0', { box: 0 }],
    ['box 6', { box: 6 }],
    ['box 99', { box: 99 }],
    ['a non-integer box', { box: 2.5 }],
    ['a string box', { box: '3' }],
    ['a missing box', { box: undefined }],
  ])('rejects %s', (_label, overrides) => {
    expect(
      parseProgressMap({ abend: progressEntry(overrides) }, NOW),
    ).toBeNull();
  });

  it('rejects a far-future lastReviewed — the value that would pin the entry', () => {
    const body = { abend: progressEntry({ lastReviewed: 8.64e15 }) };
    expect(parseProgressMap(body, NOW)).toBeNull();
  });

  it('accepts a nextDue up to the longest Leitner interval ahead', () => {
    const body = {
      abend: progressEntry({ nextDue: NOW + INTERVALS[5] * DAY }),
    };
    expect(parseProgressMap(body, NOW)).not.toBeNull();
  });

  it('rejects a nextDue beyond the longest interval plus slack', () => {
    const tooFar = NOW + INTERVALS[5] * DAY + SYNC_TIMESTAMP_SLACK_MS + 1;
    const body = { abend: progressEntry({ nextDue: tooFar }) };
    expect(parseProgressMap(body, NOW)).toBeNull();
  });

  it('rejects an unknown key on an entry — nothing strips it before KV', () => {
    const body = { abend: progressEntry({ injected: 'x' }) };
    expect(parseProgressMap(body, NOW)).toBeNull();
  });

  it('rejects a __proto__ key, which would vanish on serialise', () => {
    const body = JSON.parse('{"__proto__": {"box": 1}}');
    expect(parseProgressMap(body, NOW)).toBeNull();
  });

  it('rejects an empty or over-long entry key', () => {
    expect(parseProgressMap({ '': progressEntry() }, NOW)).toBeNull();
    const longKey = 'a'.repeat(MAX_SYNC_KEY_LEN + 1);
    expect(parseProgressMap({ [longKey]: progressEntry() }, NOW)).toBeNull();
  });

  it('rejects a body over the entry cap', () => {
    const body: Record<string, unknown> = {};
    for (let i = 0; i <= MAX_SYNC_ENTRIES; i++) body[`w${i}`] = progressEntry();
    expect(parseProgressMap(body, NOW)).toBeNull();
  });

  it('rejects the whole body when a single entry is bad', () => {
    const body = { good: progressEntry(), bad: progressEntry({ box: 99 }) };
    expect(parseProgressMap(body, NOW)).toBeNull();
  });
});

describe('parseDictationMap', () => {
  it('accepts a well-formed entry, with and without starred', () => {
    expect(parseDictationMap({ a: dictationEntry() }, NOW)).toEqual({
      a: dictationEntry(),
    });
    const starred = { a: dictationEntry({ starred: true }) };
    expect(parseDictationMap(starred, NOW)).toEqual(starred);
  });

  it('omits starred when absent rather than defaulting it', () => {
    const parsed = parseDictationMap({ a: dictationEntry() }, NOW);
    expect(parsed).not.toBeNull();
    expect('starred' in parsed!.a).toBe(false);
  });

  it('rejects correct greater than attempts', () => {
    const body = { a: dictationEntry({ attempts: 2, correct: 3 }) };
    expect(parseDictationMap(body, NOW)).toBeNull();
  });

  it('rejects streak greater than attempts', () => {
    const body = { a: dictationEntry({ attempts: 2, streak: 5 }) };
    expect(parseDictationMap(body, NOW)).toBeNull();
  });

  it('rejects negative counters', () => {
    expect(
      parseDictationMap({ a: dictationEntry({ attempts: -1 }) }, NOW),
    ).toBeNull();
  });

  it('accepts a past starredAt — the bookmark clock', () => {
    const body = {
      a: dictationEntry({ starred: false, starredAt: NOW - DAY }),
    };
    expect(parseDictationMap(body, NOW)).toEqual(body);
  });

  it('rejects a far-future starredAt, which would pin the star forever', () => {
    const body = { a: dictationEntry({ starred: true, starredAt: 8.64e15 }) };
    expect(parseDictationMap(body, NOW)).toBeNull();
  });

  it('rejects a non-numeric starredAt', () => {
    const body = { a: dictationEntry({ starred: true, starredAt: 'now' }) };
    expect(parseDictationMap(body, NOW)).toBeNull();
  });

  it('rejects a non-boolean starred', () => {
    const body = { a: dictationEntry({ starred: 'yes' }) };
    expect(parseDictationMap(body, NOW)).toBeNull();
  });

  it('rejects a far-future lastSeen', () => {
    const body = { a: dictationEntry({ lastSeen: 8.64e15 }) };
    expect(parseDictationMap(body, NOW)).toBeNull();
  });

  it('rejects an unknown key', () => {
    expect(
      parseDictationMap({ a: dictationEntry({ extra: 1 }) }, NOW),
    ).toBeNull();
  });
});

describe('parseGrammarQuizMap', () => {
  it('accepts a well-formed entry', () => {
    const body = { 'verb-position': quizEntry() };
    expect(parseGrammarQuizMap(body, NOW)).toEqual(body);
  });

  it('rejects starred — the field belongs to the dictation track only', () => {
    const body = { 'verb-position': quizEntry({ starred: true }) };
    expect(parseGrammarQuizMap(body, NOW)).toBeNull();
  });

  it('rejects correct greater than attempts', () => {
    const body = { t: quizEntry({ attempts: 1, correct: 2 }) };
    expect(parseGrammarQuizMap(body, NOW)).toBeNull();
  });

  it('rejects a far-future lastSeen', () => {
    const body = { t: quizEntry({ lastSeen: 8.64e15 }) };
    expect(parseGrammarQuizMap(body, NOW)).toBeNull();
  });
});
