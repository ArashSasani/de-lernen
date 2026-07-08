'use client';

import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
} from '@/types/grammar-quiz';
import { getDB } from './idb';

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
