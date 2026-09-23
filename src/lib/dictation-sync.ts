'use client';

import type {
  DictationProgressMap,
  DictationWordProgress,
} from '@/types/dictation';
import { getDB } from './idb';
import { mergeDictation } from './merge';
import { getToken, clearToken } from './sync';

// Shared with the server (lib/db.ts) — see lib/merge.ts.
export { pickEntries as pickDictationChanged, mergeDictation } from './merge';

const STORE = 'dictation';

export function defaultDictationProgress(): DictationWordProgress {
  return { attempts: 0, correct: 0, streak: 0, lastSeen: 0 };
}

export async function loadDictationProgress(): Promise<DictationProgressMap> {
  try {
    const db = await getDB();
    const data = await db.get(STORE, 'data');
    return (data as DictationProgressMap) ?? {};
  } catch {
    return {};
  }
}

export async function saveDictationProgress(
  p: DictationProgressMap,
): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE, p, 'data');
  } catch {
    // IndexedDB unavailable; ignore
  }
}

export async function remoteDictationLoad(): Promise<DictationProgressMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/dictation', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as DictationProgressMap;
  } catch {
    return null;
  }
}

export async function remoteDictationSync(
  progress: DictationProgressMap,
  opts: { keepalive?: boolean } = {},
): Promise<DictationProgressMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/dictation', {
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
    return (await res.json()) as DictationProgressMap;
  } catch {
    return null;
  }
}

export async function fullDictationSync(
  local: DictationProgressMap,
): Promise<DictationProgressMap> {
  const remote = await remoteDictationLoad();
  if (remote === null) return local;
  const merged = mergeDictation(local, remote);
  await saveDictationProgress(merged);
  await remoteDictationSync(merged);
  return merged;
}
