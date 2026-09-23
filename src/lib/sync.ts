'use client';

import type { ProgressMap } from '@/types';
import { getDB } from './idb';

// Both merges and the dirty-subset picker are shared with the server
// (lib/db.ts) so neither side can drift; see lib/merge.ts.
export { pickEntries as pickChanged, mergeProgress } from './merge';
import { mergeProgress } from './merge';

const STORE = 'progress';
const TOKEN_KEY = 'auth_token';

// How long to wait after the last grade before pushing progress to KV.
export const SYNC_DEBOUNCE_MS = 2000;

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
