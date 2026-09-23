import type { QuizQuestion } from '@/types/grammar-quiz';
import { grammarBank } from './dataset';
import { shuffle } from './shuffle';

export function isQuizzableTopic(topicId: string): boolean {
  return grammarBank.some((item) => item.topicId === topicId);
}

// The bank's floor is 8 items per topic, below a 10-question session, so AI-off
// sessions clamp to this instead of promising questions only repeats could fill.
export function bankPoolSize(topicId: string): number {
  return grammarBank.reduce(
    (n, item) => (item.topicId === topicId ? n + 1 : n),
    0,
  );
}

// `excludeIds` dedupes within a session; `servedAt` orders least-recently-served first
// across sessions. Shuffling before the stable sort randomises order within a recency tie.
export function generateQuestionsForTopic(
  topicId: string,
  count: number,
  excludeIds?: ReadonlySet<string>,
  servedAt?: ReadonlyMap<string, number>,
): QuizQuestion[] {
  const pool = grammarBank.filter(
    (item) => item.topicId === topicId && !excludeIds?.has(item.id),
  );
  const ordered = shuffle(pool);
  if (servedAt && servedAt.size > 0) {
    ordered.sort(
      (a, b) => (servedAt.get(a.id) ?? 0) - (servedAt.get(b.id) ?? 0),
    );
  }
  return ordered.slice(0, count);
}

export function allQuizzableTopicIds(): string[] {
  return [...new Set(grammarBank.map((item) => item.topicId))];
}
