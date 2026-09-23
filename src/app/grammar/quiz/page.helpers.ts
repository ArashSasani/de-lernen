import type {
  GrammarQuizProgressMap,
  GrammarQuizTopicProgress,
  QuizDifficulty,
  QuizPlan,
  QuizTier,
} from '@/types/grammar-quiz';
import { defaultGrammarQuizProgress } from '@/lib/grammar-quiz-sync';
import { allQuizzableTopicIds } from '@/lib/grammar-quiz';
import { shuffle } from '@/lib/shuffle';

export const QUIZ_SESSION_SIZE = 12;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function tier(
  p: { attempts: number; correct: number; lastSeen: number },
  now: number,
): QuizTier {
  // Struggling (low accuracy) is the top priority — fix errors before adding new topics.
  if (p.attempts >= 2 && p.correct / p.attempts < 0.7) return 0;
  if (p.attempts === 0) return 1;
  if (now - p.lastSeen > 3 * MS_PER_DAY) return 2;
  return 3;
}

// Skews harder than the bank's default distribution: `easy` is reserved for
// a topic genuinely new to the learner, not the resting state. A struggling
// topic holds `medium` rather than dropping to `easy` — the explanation and
// injected mistake notes do the scaffolding, not a softer question.
export function difficultyFor(
  p: GrammarQuizTopicProgress,
  recentResults: boolean[] = [],
): QuizDifficulty {
  if (p.attempts === 0) return 'easy';
  const accuracy = p.correct / p.attempts;
  if (accuracy < 0.7) return 'medium';
  const recentAccuracy =
    recentResults.length > 0
      ? recentResults.filter(Boolean).length / recentResults.length
      : accuracy;
  return accuracy >= 0.85 && recentAccuracy >= 0.7 ? 'hard' : 'medium';
}

// Pure planner — ids, counts, and a difficulty hint. Injectable `now`/`order`
// so the tier logic is testable without mocking Date.now()/shuffle().
export function selectQuizTopics(
  progress: GrammarQuizProgressMap,
  opts?: { now?: number; order?: (ids: string[]) => string[] },
): QuizPlan[] {
  const now = opts?.now ?? Date.now();
  const order = opts?.order ?? shuffle;
  const topicIds = allQuizzableTopicIds();

  const sorted = order(topicIds).sort((a, b) => {
    const pa = progress[a] ?? defaultGrammarQuizProgress();
    const pb = progress[b] ?? defaultGrammarQuizProgress();
    const ta = tier(pa, now);
    const tb = tier(pb, now);
    if (ta !== tb) return ta - tb;
    if (ta === 0) {
      return pa.correct / pa.attempts - pb.correct / pb.attempts;
    }
    if (ta === 2 || ta === 3) {
      return pa.lastSeen - pb.lastSeen;
    }
    return 0;
  });

  const plan: QuizPlan[] = [];
  let total = 0;
  for (const topicId of sorted) {
    if (total >= QUIZ_SESSION_SIZE) break;
    const remaining = QUIZ_SESSION_SIZE - total;
    const count = Math.min(2, remaining);
    const p = progress[topicId] ?? defaultGrammarQuizProgress();
    plan.push({
      topicId,
      count,
      tier: tier(p, now),
      difficulty: difficultyFor(p),
    });
    total += count;
  }
  return plan;
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
