import { kv } from '@vercel/kv';
import type { ProgressMap, WordProgress } from '@/types';
import type {
  DictationProgressMap,
  DictationWordProgress,
} from '@/types/dictation';

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
