import { WORD_INTENTS } from '@/constants';
import type { Article, Level } from '@/types';

export type WordIntent = (typeof WORD_INTENTS)[number];

export interface AiWordFields {
  lemma: string;
  article: Article | null;
  plural: string | null;
  en: string;
}

export interface WordIntentRequest {
  intent: WordIntent;
  level: Level; // per-content floor: wordLevel(word)
  learnerLevel?: Level; // Settings pref; server defaults to 'a1' if missing/invalid
  word: AiWordFields;
  question?: string; // present only when intent === 'ask'
}

// M4 ships only word-intents. M6 adds a `grammar` intent as a second union member
// (`| GrammarIntentRequest`) — kept as a plain alias today so that addition is a
// union extension, not a rewrite.
export type AiRequest = WordIntentRequest;
