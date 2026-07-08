import type { DailyText, ProgressMap } from '@/types';

// localStorage keys for the once-per-day surfacing. Local-only state (no KV
// sync) — losing it across devices just means the modal may show again, which
// is harmless. Wrapped in try/catch like the token helpers in sync.ts so
// private-browsing / disabled storage degrades gracefully.
const SHOWN_DATE_KEY = 'daily_read_shown_date';
const TODAYS_PICK_KEY = 'daily_read_today';

// The words the user is currently struggling with: explicitly graded into
// box 1. Ungraded words also default to box 1 in the Leitner model, but they
// have no progress entry, so they are excluded here on purpose — the daily text
// targets words the user has actually missed.
export function strugglingIds(progress: ProgressMap): Set<string> {
  const ids = new Set<string>();
  for (const [id, p] of Object.entries(progress)) {
    if (p.box === 1) ids.add(id);
  }
  return ids;
}

// How many of a text's target words the user is struggling with.
export function scoreText(text: DailyText, struggling: Set<string>): number {
  let n = 0;
  for (const id of text.wordIds) if (struggling.has(id)) n++;
  return n;
}

// Deterministic, non-negative hash of a string. Used to vary tiebreaks and the
// fallback pick by day without any randomness (which would break determinism).
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Pick the day's text. Highest overlap with the struggling set wins; ties break
// deterministically by a per-day hash so equally-good texts rotate day to day.
// When nothing overlaps (e.g. the user hasn't missed any covered word yet), we
// fall back to a deterministic daily rotation so there is always a reading.
export function pickDailyText(
  texts: DailyText[],
  struggling: Set<string>,
  dateSeed: string,
): DailyText | null {
  if (texts.length === 0) return null;

  let best: DailyText | null = null;
  let bestScore = -1;
  let bestTie = -1;
  for (const t of texts) {
    const score = scoreText(t, struggling);
    const tie = hashSeed(`${dateSeed}:${t.id}`);
    if (score > bestScore || (score === bestScore && tie > bestTie)) {
      best = t;
      bestScore = score;
      bestTie = tie;
    }
  }

  if (bestScore <= 0) {
    return texts[hashSeed(dateSeed) % texts.length];
  }
  return best;
}

// Local date as YYYY-MM-DD (the unit the once-per-day gate works in).
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getShownDate(): string | null {
  try {
    return localStorage.getItem(SHOWN_DATE_KEY);
  } catch {
    return null;
  }
}

export function markShownToday(day: string = todayKey()): void {
  try {
    localStorage.setItem(SHOWN_DATE_KEY, day);
  } catch {
    // storage unavailable; the modal may show again, which is fine
  }
}

export interface TodaysPick {
  date: string;
  textId: string;
}

export function getTodaysPick(): TodaysPick | null {
  try {
    const raw = localStorage.getItem(TODAYS_PICK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TodaysPick;
  } catch {
    return null;
  }
}

export function setTodaysPick(pick: TodaysPick): void {
  try {
    localStorage.setItem(TODAYS_PICK_KEY, JSON.stringify(pick));
  } catch {
    // ignore
  }
}
