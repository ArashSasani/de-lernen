'use client';

import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
} from '@/types/grammar-quiz';
import { getDB } from './idb';
import { getToken, clearToken } from './sync';

const STORE = 'grammar-quiz';

export function defaultGrammarQuizProgress(): GrammarQuizTopicProgress {
  return { attempts: 0, correct: 0, streak: 0, lastSeen: 0 };
}

export async function loadGrammarQuizProgress(): Promise<GrammarQuizProgressMap> {
  try {
    const db = await getDB();
    const data = await db.get(STORE, 'data');
    return (data as GrammarQuizProgressMap) ?? {};
  } catch {
    return {};
  }
}

export async function saveGrammarQuizProgress(
  p: GrammarQuizProgressMap,
): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE, p, 'data');
  } catch {
    // IndexedDB unavailable; ignore
  }
}

export function pickGrammarQuizChanged(
  progress: GrammarQuizProgressMap,
  ids: Iterable<string>,
): GrammarQuizProgressMap {
  const out: GrammarQuizProgressMap = {};
  for (const id of ids) {
    const p = progress[id];
    if (p) out[id] = p;
  }
  return out;
}

// Client-side copy of db.ts mergeGrammarQuiz — kept in sync manually.
// Newest-wins by lastSeen.
export function mergeGrammarQuiz(
  local: GrammarQuizProgressMap,
  remote: GrammarQuizProgressMap,
): GrammarQuizProgressMap {
  const merged: GrammarQuizProgressMap = { ...remote };
  for (const [id, localEntry] of Object.entries(local)) {
    const remoteEntry: GrammarQuizTopicProgress | undefined = merged[id];
    if (!remoteEntry || localEntry.lastSeen > remoteEntry.lastSeen) {
      merged[id] = localEntry;
    }
  }
  return merged;
}

export async function remoteGrammarQuizLoad(): Promise<GrammarQuizProgressMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/grammar-quiz', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as GrammarQuizProgressMap;
  } catch {
    return null;
  }
}

export async function remoteGrammarQuizSync(
  progress: GrammarQuizProgressMap,
  opts: { keepalive?: boolean } = {},
): Promise<GrammarQuizProgressMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/grammar-quiz', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(progress),
      keepalive: opts.keepalive ?? false,
    });
    if (res.status === 401) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as GrammarQuizProgressMap;
  } catch {
    return null;
  }
}

export async function fullGrammarQuizSync(
  local: GrammarQuizProgressMap,
): Promise<GrammarQuizProgressMap> {
  const remote = await remoteGrammarQuizLoad();
  if (remote === null) return local;
  const merged = mergeGrammarQuiz(local, remote);
  await saveGrammarQuizProgress(merged);
  await remoteGrammarQuizSync(merged);
  return merged;
}
