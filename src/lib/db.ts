import { kv } from '@vercel/kv';
import { MISTAKE_SOURCES, MISTAKES_MAX_CORPUS } from '@/constants';
import type { ProgressMap, WordProgress } from '@/types';
import type {
  DictationProgressMap,
  DictationWordProgress,
} from '@/types/dictation';
import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
} from '@/types/grammar-quiz';
import type { MistakeCorpus, MistakeRecord } from '@/types/mistakes';

const KV_KEY = 'user:progress';

export async function loadProgress(): Promise<ProgressMap> {
  try {
    const data = await kv.get<ProgressMap>(KV_KEY);
    return data ?? {};
  } catch {
    return {};
  }
}

export async function saveProgress(progress: ProgressMap): Promise<void> {
  try {
    await kv.set(KV_KEY, progress);
  } catch {
    // KV not configured (e.g. local dev without KV_*) — no-op
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

const DICTATION_KV_KEY = 'user:dictation';

export async function loadDictation(): Promise<DictationProgressMap> {
  try {
    const data = await kv.get<DictationProgressMap>(DICTATION_KV_KEY);
    return data ?? {};
  } catch {
    return {};
  }
}

export async function saveDictation(p: DictationProgressMap): Promise<void> {
  try {
    await kv.set(DICTATION_KV_KEY, p);
  } catch {
    // KV not configured (e.g. local dev without KV_*) — no-op
  }
}

export function mergeDictation(
  local: DictationProgressMap,
  remote: DictationProgressMap,
): DictationProgressMap {
  const merged: DictationProgressMap = { ...remote };
  for (const [id, localEntry] of Object.entries(local)) {
    const remoteEntry: DictationWordProgress | undefined = merged[id];
    if (!remoteEntry || localEntry.lastSeen > remoteEntry.lastSeen) {
      merged[id] = localEntry;
    }
    // OR-merge starred: a bookmark is never lost on merge
    if (localEntry.starred || remoteEntry?.starred) {
      merged[id] = { ...merged[id], starred: true };
    }
  }
  return merged;
}

const GRAMMAR_QUIZ_KV_KEY = 'user:grammar-quiz';

export async function loadGrammarQuiz(): Promise<GrammarQuizProgressMap> {
  try {
    const data = await kv.get<GrammarQuizProgressMap>(GRAMMAR_QUIZ_KV_KEY);
    return data ?? {};
  } catch {
    return {};
  }
}

export async function saveGrammarQuiz(
  p: GrammarQuizProgressMap,
): Promise<void> {
  try {
    await kv.set(GRAMMAR_QUIZ_KV_KEY, p);
  } catch {
    // KV not configured (e.g. local dev without KV_*) — no-op
  }
}

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

const MISTAKES_KV_KEY = 'user:mistakes';

const KNOWN_SOURCES: readonly string[] = MISTAKE_SOURCES;

export async function loadMistakes(): Promise<MistakeCorpus> {
  try {
    const data = await kv.get<MistakeCorpus>(MISTAKES_KV_KEY);
    // An unrecognised source can't be merged or rendered; the next save
    // persists the filtered corpus, so it clears without a migration.
    return (data ?? []).filter((r) => KNOWN_SOURCES.includes(r.source));
  } catch {
    return [];
  }
}

// Throws, unlike saveProgress: the client clears its dirty set on a 200 and
// a record is pushed once, so a swallowed write would lose it for good.
export async function saveMistakes(corpus: MistakeCorpus): Promise<void> {
  await kv.set(MISTAKES_KV_KEY, corpus);
}

// Server copy of mistakes-sync.ts's stripLocal — strips defensively again
// in case a stale client smuggles a local-only field into the PUT body.
function stripLocal(record: MistakeRecord): MistakeRecord {
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

// Union by id (records are immutable) — no tombstones, unlike the
// newest-wins-per-field merges above.
export function mergeMistakes(
  local: MistakeCorpus,
  remote: MistakeCorpus,
): MistakeCorpus {
  const byId = new Map<string, MistakeRecord>();
  for (const r of remote) byId.set(r.id, r);
  for (const r of local) {
    if (!byId.has(r.id)) byId.set(r.id, stripLocal(r));
  }
  return [...byId.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MISTAKES_MAX_CORPUS);
}
