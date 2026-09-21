'use client';

import { MISTAKE_SOURCES, MISTAKES_MAX_CORPUS } from '@/constants';
import type { MistakeCorpus, MistakeRecord } from '@/types/mistakes';
import { getDB } from './idb';
import { getToken, clearToken } from './sync';

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

// Explicit allow-list, not a destructure-and-discard, so a future local-only
// field is stripped by default instead of leaking until deny-listed too.
export function stripLocal(record: MistakeRecord): MistakeRecord {
  const clean: MistakeRecord = {
    id: record.id,
    source: record.source,
    text: record.text,
    createdAt: record.createdAt,
  };
  if (record.wordId !== undefined) clean.wordId = record.wordId;
  if (record.topicId !== undefined) clean.topicId = record.topicId;
  if (record.level !== undefined) clean.level = record.level;
  return clean;
}

// Client-side copy of db.ts mergeMistakes, kept in sync manually. Union by
// id (records are immutable), newest-first, capped so the log can't grow forever.
export function mergeMistakes(
  local: MistakeCorpus,
  remote: MistakeCorpus,
): MistakeCorpus {
  const byId = new Map<string, MistakeRecord>();
  for (const r of remote) byId.set(r.id, r);
  for (const r of local) if (!byId.has(r.id)) byId.set(r.id, r);
  return [...byId.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MISTAKES_MAX_CORPUS);
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
