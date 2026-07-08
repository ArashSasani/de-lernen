import type { GrammarQuizProgressMap } from '@/types/grammar-quiz';
import type { QuizQuestion } from '@/types/grammar-quiz';
import { defaultGrammarQuizProgress } from '@/lib/grammar-quiz-sync';
import {
  allQuizzableTopicIds,
  generateQuestionsForTopic,
} from '@/lib/grammar-quiz';
import { shuffle } from '@/lib/shuffle';

export const QUIZ_SESSION_SIZE = 12;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Tier = 0 | 1 | 2 | 3;

function tier(p: {
  attempts: number;
  correct: number;
  lastSeen: number;
}): Tier {
  // Struggling (low accuracy) is the top priority — fix errors before adding new topics.
  if (p.attempts >= 2 && p.correct / p.attempts < 0.7) return 0;
  if (p.attempts === 0) return 1;
  if (Date.now() - p.lastSeen > 3 * MS_PER_DAY) return 2;
  return 3;
}

export function buildSmartQuiz(
  progress: GrammarQuizProgressMap,
): QuizQuestion[] {
  const topicIds = allQuizzableTopicIds();

  const sorted = shuffle(topicIds).sort((a, b) => {
    const pa = progress[a] ?? defaultGrammarQuizProgress();
    const pb = progress[b] ?? defaultGrammarQuizProgress();
    const ta = tier(pa);
    const tb = tier(pb);
    if (ta !== tb) return ta - tb;
    if (ta === 1) {
      return pa.correct / pa.attempts - pb.correct / pb.attempts;
    }
    if (ta === 2 || ta === 3) {
      return pa.lastSeen - pb.lastSeen;
    }
    return 0;
  });

  // Pick top topics, generate 2 questions each until we fill the session
  const questions: QuizQuestion[] = [];
  for (const topicId of sorted) {
    if (questions.length >= QUIZ_SESSION_SIZE) break;
    const remaining = QUIZ_SESSION_SIZE - questions.length;
    const count = Math.min(2, remaining);
    const qs = generateQuestionsForTopic(topicId, count);
    questions.push(...qs);
  }

  return shuffle(questions);
}

export function buildTopicQuiz(topicId: string): QuizQuestion[] {
  return generateQuestionsForTopic(topicId, 10);
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
