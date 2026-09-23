'use client';

import { BANK_ROTATION_MAX } from '@/constants';

// When each frozen bank item was last served — per-device localStorage, never synced,
// since it shapes question order rather than progress. See grammar-quiz.md.
const KEY = 'bank_served_at';

export type ServedAt = Map<string, number>;

export function getServedAt(): ServedAt {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return new Map();
    const out: ServedAt = new Map();
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === 'number' && Number.isFinite(at)) out.set(id, at);
    }
    return out;
  } catch {
    return new Map();
  }
}

// Pruned to the newest N: a dropped entry reads as "never served", the oldest recency anyway.
export function markServed(
  ids: readonly string[],
  now: number = Date.now(),
): void {
  if (ids.length === 0) return;
  try {
    const served = getServedAt();
    for (const id of ids) served.set(id, now);
    const kept = [...served.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, BANK_ROTATION_MAX);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // storage unavailable; rotation degrades to a plain reshuffle
  }
}
