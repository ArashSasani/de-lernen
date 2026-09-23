import type { DailyText, Word } from '@/types';
import type { QuizQuestion } from '@/types/grammar-quiz';

// The large corpora, fetched from /data/*.json and SW-precached rather than bundled (ADR 013).
// Populated IN PLACE with a stable identity; empty until loadDataset() resolves.
export const allWords: Word[] = [];
export const dailyTexts: DailyText[] = [];
export const grammarBank: QuizQuestion[] = [];

// Indexed because both are read inside render paths (WordPopover, the read page).
const wordsById = new Map<string, Word>();
const dailyTextsById = new Map<string, DailyText>();

export function wordById(id: string): Word | undefined {
  return wordsById.get(id);
}

export function dailyTextById(id: string): DailyText | undefined {
  return dailyTextsById.get(id);
}

function fill<T>(target: T[], source: readonly T[]): void {
  target.length = 0;
  for (const item of source) target.push(item);
}

export interface DatasetPayload {
  words: Word[];
  dailyTexts: DailyText[];
  grammarBank: QuizQuestion[];
}

// Also the seam Jest loads the real corpora through (jest.dataset.ts).
export function hydrateDataset(payload: DatasetPayload): void {
  fill(allWords, payload.words);
  fill(dailyTexts, payload.dailyTexts);
  fill(grammarBank, payload.grammarBank);
  wordsById.clear();
  for (const w of allWords) wordsById.set(w.id, w);
  dailyTextsById.clear();
  for (const t of dailyTexts) dailyTextsById.set(t.id, t);
}

export function isDatasetLoaded(): boolean {
  return allWords.length > 0;
}

async function fetchCorpus<T>(name: string): Promise<T[]> {
  const res = await fetch(`/data/${name}`);
  if (!res.ok) throw new Error(`/data/${name}: ${res.status}`);
  return (await res.json()) as T[];
}

let pending: Promise<void> | null = null;

// Never rejects: a failed load leaves the arrays empty (each page's own empty
// state) and drops the memo so the next navigation retries.
export function loadDataset(): Promise<void> {
  if (isDatasetLoaded()) return Promise.resolve();
  pending ??= (async () => {
    try {
      const [words, texts, bank] = await Promise.all([
        fetchCorpus<Word>('words.json'),
        fetchCorpus<DailyText>('daily-texts.json'),
        fetchCorpus<QuizQuestion>('grammar-bank.json'),
      ]);
      hydrateDataset({ words, dailyTexts: texts, grammarBank: bank });
    } catch (err) {
      console.error('[dataset] load failed:', err);
      pending = null;
    }
  })();
  return pending;
}
