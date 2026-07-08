'use client';

import type { ProgressMap, WordProgress } from '@/types';
import { getDB } from './idb';

const STORE = 'progress';
const TOKEN_KEY = 'auth_token';

// How long to wait after the last grade before pushing progress to KV.
export const SYNC_DEBOUNCE_MS = 2000;

// Sync sends only the words that changed since the last confirmed push, not the
// whole ProgressMap. With ~1300 words the full map is ~93KB, which exceeds the
// 64KB cap the Fetch spec puts on `keepalive` request bodies — so the on-hide /
// on-pagehide flush (the iOS PWA durability path) would silently reject and the
// last grades would be lost, reverting graded cards to box 1. The server merge
// (mergeProgress) starts from the full KV map and overlays whatever subset it
// receives, so a partial payload is correct as well as small.
export function pickChanged(
  progress: ProgressMap,
  ids: Iterable<string>,
): ProgressMap {
  const out: ProgressMap = {};
  for (const id of ids) {
    const p = progress[id];
    if (p) out[id] = p;
  }
  return out;
}

export async function localLoad(): Promise<ProgressMap> {
  try {
    const db = await getDB();
    const data = await db.get(STORE, 'data');
    return (data as ProgressMap) ?? {};
  } catch {
    return {};
  }
}

export async function localSave(progress: ProgressMap): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE, progress, 'data');
  } catch {
    // IndexedDB unavailable; ignore
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function mergeProgress(
  local: ProgressMap,
  remote: ProgressMap,
): ProgressMap {
  const merged: ProgressMap = { ...remote };
  for (const [id, localEntry] of Object.entries(local)) {
    const remoteEntry: WordProgress | undefined = merged[id];
    if (!remoteEntry || localEntry.lastReviewed > remoteEntry.lastReviewed) {
      merged[id] = localEntry;
    }
  }
  return merged;
}

export async function remoteLoad(): Promise<ProgressMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/progress', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as ProgressMap;
  } catch {
    return null;
  }
}

export async function remoteSync(
  progress: ProgressMap,
  opts: { keepalive?: boolean } = {},
): Promise<ProgressMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/progress', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(progress),
      // keepalive lets the PUT outlive a page that is being backgrounded / killed
      // (the iOS PWA flush-on-hide path); the Bearer header is preserved, unlike
      // navigator.sendBeacon.
      keepalive: opts.keepalive ?? false,
    });
    if (res.status === 401) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as ProgressMap;
  } catch {
    return null;
  }
}

export async function fullSync(
  localProgress: ProgressMap,
): Promise<ProgressMap> {
  const remote = await remoteLoad();
  if (remote === null) return localProgress;
  const merged = mergeProgress(localProgress, remote);
  await localSave(merged);
  await remoteSync(merged);
  return merged;
}
