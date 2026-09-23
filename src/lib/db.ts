import { kv } from '@vercel/kv';
import { MISTAKE_SOURCES } from '@/constants';
import type { ProgressMap } from '@/types';
import type { DictationProgressMap } from '@/types/dictation';
import type { GrammarQuizProgressMap } from '@/types/grammar-quiz';
import type { MistakeCorpus } from '@/types/mistakes';
import { mergeMistakes as mergeMistakesShared, stripLocal } from './merge';

// Defined once in lib/merge.ts; re-exported so server callers keep one import
// while the client *-sync.ts modules pull the same functions.
export {
  mergeProgress,
  mergeDictation,
  mergeGrammarQuiz,
  pickEntries,
} from './merge';

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

// Strips defensively on insert, in case a stale client smuggles a
// local-only field (`confidence`) into the PUT body.
export function mergeMistakes(
  local: MistakeCorpus,
  remote: MistakeCorpus,
): MistakeCorpus {
  return mergeMistakesShared(local, remote, stripLocal);
}
