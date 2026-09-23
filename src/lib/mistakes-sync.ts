'use client';

import { MISTAKE_SOURCES } from '@/constants';
import type { MistakeCorpus, MistakeRecord } from '@/types/mistakes';
import { getDB } from './idb';
import { mergeMistakes, stripLocal } from './merge';
import { getToken, clearToken } from './sync';

// Shared with the server (lib/merge.ts); the client merges without the strip,
// keeping `confidence` on its own records.
export { mergeMistakes, stripLocal } from './merge';

const STORE = 'mistakes';

const KNOWN_SOURCES: readonly string[] = MISTAKE_SOURCES;

export function hasKnownSource(record: MistakeRecord): boolean {
  return KNOWN_SOURCES.includes(record.source);
}

// A keyed log (records append, no rewrite), not the blob-at-key-'data'
// pattern the other three tracks use.
export async function loadMistakes(): Promise<MistakeCorpus> {
  try {
    const db = await getDB();
    const all = (await db.getAll(STORE)) as MistakeCorpus;
    const kept = all.filter(hasKnownSource);
    // Deleted, not just filtered out: a row the route would reject has to
    // leave the store, or every PUT that includes it fails.
    if (kept.length !== all.length) {
      const stale = all.filter((r) => !hasKnownSource(r));
      const tx = db.transaction(STORE, 'readwrite');
      await Promise.all([...stale.map((r) => tx.store.delete(r.id)), tx.done]);
    }
    return kept;
  } catch {
    return [];
  }
}

export async function saveMistake(record: MistakeRecord): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE, record);
  } catch {
    // IndexedDB unavailable; ignore
  }
}

// Batch write: one connection and one transaction, since saveMistake opens
// its own connection per call.
export async function saveMistakesLocal(records: MistakeCorpus): Promise<void> {
  if (records.length === 0) return;
  try {
    const db = await getDB();
    const tx = db.transaction(STORE, 'readwrite');
    await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
  } catch {
    // IndexedDB unavailable; ignore
  }
}

// Keeps the keepalive PUT under the 64KB cap, like pickChanged in sync.ts —
// union-by-id merge makes a partial payload correct on the server.
export function pickNewMistakes(
  corpus: MistakeCorpus,
  ids: Iterable<string>,
): MistakeCorpus {
  const idSet = new Set(ids);
  return corpus.filter((r) => idSet.has(r.id));
}

// The local records the server doesn't have yet — the only thing a full
// sync needs to PUT, since the server merges union-by-id.
export function pickUnpushed(
  merged: MistakeCorpus,
  remote: MistakeCorpus,
): MistakeCorpus {
  const remoteIds = new Set(remote.map((r) => r.id));
  return merged.filter((r) => !remoteIds.has(r.id));
}

export async function remoteMistakesLoad(): Promise<MistakeCorpus | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/mistakes', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as MistakeCorpus;
  } catch {
    return null;
  }
}

export async function remoteMistakesSync(
  corpus: MistakeCorpus,
  opts: { keepalive?: boolean } = {},
): Promise<MistakeCorpus | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/mistakes', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(corpus.map(stripLocal)),
      keepalive: opts.keepalive ?? false,
    });
    if (res.status === 401) {
      clearToken();
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as MistakeCorpus;
  } catch {
    return null;
  }
}

export async function fullMistakesSync(
  local: MistakeCorpus,
): Promise<MistakeCorpus> {
  const remote = await remoteMistakesLoad();
  if (remote === null) return local;
  const merged = mergeMistakes(local, remote);
  await saveMistakesLocal(merged);
  // Only what the server is missing: the PUT body is record-capped, and
  // union-by-id makes a partial payload correct.
  const unpushed = pickUnpushed(merged, remote);
  if (unpushed.length > 0) await remoteMistakesSync(unpushed);
  return merged;
}
