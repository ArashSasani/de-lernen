import { MISTAKE_SOURCES } from '@/constants';
import type { Level } from '@/types';

// The graded tracks a note can be authored from. Tap-a-word is excluded:
// asking about a word is a quick check, not evidence of a gap.
export type MistakeSource = (typeof MISTAKE_SOURCES)[number];

// Immutable, RAG-ready. Backlinks/id are stamped from ground truth by the
// gate, never trusted from the model.
export interface MistakeRecord {
  id: string; // `${source}:${ref}:${createdAt}` — deterministic, not a uuid
  source: MistakeSource;
  text: string; // the RAG payload
  wordId?: string;
  topicId?: string;
  level?: Level;
  createdAt: number; // ms
  // Local-only debug/Phase-2 fields — NEVER synced (stripped before every PUT).
  confidence?: number;
  seenCount?: number;
  lastSeen?: number;
  embedding?: number[];
}

export type MistakeCorpus = MistakeRecord[];
