'use client';

import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
} from '@/types/grammar-quiz';
import { getDB } from './idb';
import { mergeGrammarQuiz } from './merge';
import { getToken, clearToken } from './sync';

// Shared with the server (lib/db.ts) — see lib/merge.ts.
export {
  pickEntries as pickGrammarQuizChanged,
  mergeGrammarQuiz,
} from './merge';

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
