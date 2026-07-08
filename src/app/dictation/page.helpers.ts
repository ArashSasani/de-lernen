import type { Word } from '@/types';
import type {
  DictationProgressMap,
  DictationWordProgress,
} from '@/types/dictation';
import { allWords } from '@/lib/words';
import { defaultDictationProgress } from '@/lib/dictation-sync';
import { shuffle } from '@/lib/shuffle';

export const DICTATION_SESSION_SIZE = 15;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function targetToken(lemma: string): string {
  return lemma.split(' ').reduce((a, b) => (b.length > a.length ? b : a), '');
}

function isEligible(word: Word): boolean {
  if (word.lemma.includes(',')) return false;
  if (targetToken(word.lemma).length <= 2) return false;
  return true;
}

type Tier = 0 | 1 | 2 | 3;

function tier(p: DictationWordProgress): Tier {
  if (p.attempts === 0) return 0;
  const acc = p.correct / p.attempts;
  if (acc < 0.7 && p.attempts >= 2) return 1;
  if (Date.now() - p.lastSeen > 3 * MS_PER_DAY) return 2;
  return 3;
}

export function buildDictationQueue(
  progress: DictationProgressMap,
  {
    words = allWords,
    starredOnly = false,
  }: { words?: Word[]; starredOnly?: boolean } = {},
): Word[] {
  const pool = starredOnly
    ? words.filter((w) => progress[w.id]?.starred === true)
    : words;
  const eligible = pool.filter(isEligible);
  const shuffled = shuffle(eligible);

  shuffled.sort((a, b) => {
    const pa = progress[a.id] ?? defaultDictationProgress();
    const pb = progress[b.id] ?? defaultDictationProgress();
    const ta = tier(pa);
    const tb = tier(pb);
    if (ta !== tb) return ta - tb;

    // Within the same tier, secondary sort
    if (ta === 1) {
      // worst accuracy first
      const accA = pa.correct / pa.attempts;
      const accB = pb.correct / pb.attempts;
      return accA - accB;
    }
    if (ta === 2 || ta === 3) {
      // oldest first
      return pa.lastSeen - pb.lastSeen;
    }
    return 0;
  });

  return shuffled.slice(0, DICTATION_SESSION_SIZE);
}

export function sessionStats(results: boolean[]): {
  total: number;
  correct: number;
  pct: number;
} {
  const total = results.length;
  const correct = results.filter(Boolean).length;
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { total, correct, pct };
}
