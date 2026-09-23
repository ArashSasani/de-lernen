import { MISTAKES_MAX_CORPUS } from '@/constants';
import type { ProgressMap } from '@/types';
import type {
  DictationProgressMap,
  DictationWordProgress,
} from '@/types/dictation';
import type { GrammarQuizProgressMap } from '@/types/grammar-quiz';
import type { MistakeCorpus, MistakeRecord } from '@/types/mistakes';

// The one definition of every merge, re-exported by lib/db.ts (server) and the
// client *-sync.ts modules: a merge that differs per side lets one device clobber the other.

// Only the dirty subset is pushed: a full map exceeds the 64KB keepalive body cap
// (ADR 004), and every merge below overlays a partial payload onto the remote map.
export function pickEntries<T>(
  map: Record<string, T>,
  ids: Iterable<string>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const id of ids) {
    const entry = map[id];
    if (entry) out[id] = entry;
  }
  return out;
}

// Newest-wins per key; `at` names the field that dates an entry.
function mergeNewestWins<T>(
  local: Record<string, T>,
  remote: Record<string, T>,
  at: (entry: T) => number,
): Record<string, T> {
  const merged: Record<string, T> = { ...remote };
  for (const [id, localEntry] of Object.entries(local)) {
    const remoteEntry: T | undefined = merged[id];
    if (!remoteEntry || at(localEntry) > at(remoteEntry)) {
      merged[id] = localEntry;
    }
  }
  return merged;
}

export function mergeProgress(
  local: ProgressMap,
  remote: ProgressMap,
): ProgressMap {
  return mergeNewestWins(local, remote, (p) => p.lastReviewed);
}

export function mergeGrammarQuiz(
  local: GrammarQuizProgressMap,
  remote: GrammarQuizProgressMap,
): GrammarQuizProgressMap {
  return mergeNewestWins(local, remote, (p) => p.lastSeen);
}

type StarState = Pick<DictationWordProgress, 'starred' | 'starredAt'>;

// Newest `starredAt` wins, independent of `lastSeen`. With no clock on either side
// (entries predating the field) it can only OR-merge, so no bookmark is dropped.
function mergeStarred(
  local: DictationWordProgress | undefined,
  remote: DictationWordProgress | undefined,
): StarState {
  const localAt = local?.starredAt;
  const remoteAt = remote?.starredAt;
  if (localAt !== undefined && remoteAt !== undefined) {
    return localAt >= remoteAt
      ? { starred: local?.starred, starredAt: localAt }
      : { starred: remote?.starred, starredAt: remoteAt };
  }
  if (localAt !== undefined) {
    return { starred: local?.starred, starredAt: localAt };
  }
  if (remoteAt !== undefined) {
    return { starred: remote?.starred, starredAt: remoteAt };
  }
  const starred = local?.starred || remote?.starred;
  return starred ? { starred: true } : {};
}

export function mergeDictation(
  local: DictationProgressMap,
  remote: DictationProgressMap,
): DictationProgressMap {
  const merged: DictationProgressMap = { ...remote };
  for (const [id, localEntry] of Object.entries(local)) {
    const remoteEntry: DictationWordProgress | undefined = remote[id];
    const newest =
      !remoteEntry || localEntry.lastSeen > remoteEntry.lastSeen
        ? localEntry
        : remoteEntry;
    const star = mergeStarred(localEntry, remoteEntry);
    merged[id] = {
      attempts: newest.attempts,
      correct: newest.correct,
      streak: newest.streak,
      lastSeen: newest.lastSeen,
      ...(star.starred !== undefined ? { starred: star.starred } : {}),
      ...(star.starredAt !== undefined ? { starredAt: star.starredAt } : {}),
    };
  }
  return merged;
}

// Explicit allow-list, so a future local-only field is stripped by default.
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

// Union by id (records are immutable), newest-first, capped. The server passes
// `stripLocal`; the client keeps `confidence` on its own records for debugging.
export function mergeMistakes(
  local: MistakeCorpus,
  remote: MistakeCorpus,
  transformLocal: (record: MistakeRecord) => MistakeRecord = (r) => r,
): MistakeCorpus {
  const byId = new Map<string, MistakeRecord>();
  for (const r of remote) byId.set(r.id, r);
  for (const r of local) {
    if (!byId.has(r.id)) byId.set(r.id, transformLocal(r));
  }
  return [...byId.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MISTAKES_MAX_CORPUS);
}
