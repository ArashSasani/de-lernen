// The corpora are fetched at runtime in the browser (ADR 013); under Jest they are
// hydrated from disk, once per test file, through the same accessors the app uses.
import { hydrateDataset } from './src/lib/dataset';
import words from './data/words.json';
import dailyTexts from './data/daily-texts.json';
import grammarBank from './data/grammar-bank.json';
import type { DatasetPayload } from './src/lib/dataset';

hydrateDataset({ words, dailyTexts, grammarBank } as unknown as DatasetPayload);
