import { ARTICLE, POS, BOXES } from '@/constants';

export type Article = (typeof ARTICLE)[keyof typeof ARTICLE];
export type Pos = (typeof POS)[keyof typeof POS];
export type Box = (typeof BOXES)[number];

export interface Word {
  id: string;
  lemma: string;
  article: Article | null;
  plural: string | null;
  en: string;
  pos: Pos;
  examples: string[];
  sources: string[];
  corrected?: boolean;
}

export interface WordProgress {
  box: Box;
  lastReviewed: number;
  nextDue: number;
}

export type ProgressMap = Record<string, WordProgress>;

// A daily reading text (A1 exam-style) with pre-computed annotations so the
// running app never does any NLP: `wordIds` drives box-1 matching/scoring and
// `spans` are exact character offsets into `text` for highlighting. Built once
// by scripts/build-daily-texts.mjs from data/sources/daily-texts.src.json.
export interface DailyTextSpan {
  start: number;
  end: number;
  wordId: string;
}

export interface DailyText {
  id: string;
  title: string;
  topic: string;
  text: string;
  wordIds: string[];
  spans: DailyTextSpan[];
}

export type GrammarCategory =
  | 'verben'
  | 'nomen-artikel'
  | 'pronomen'
  | 'satzbau'
  | 'praepositionen'
  | 'negation'
  | 'adverbien'
  | 'verben-kasus'
  | 'zahlen';

export interface GrammarTable {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface GrammarExample {
  de: string;
  en: string;
}

export interface GrammarTopic {
  id: string;
  category: GrammarCategory;
  title: string;
  summary: string;
  explanation: string;
  tables: GrammarTable[];
  examples: GrammarExample[];
  tips: string[];
}
