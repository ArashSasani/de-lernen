import type { QuizQuestion } from '@/types/grammar-quiz';
import grammarBankData from '../../data/grammar-bank.json';
import { shuffle } from './shuffle';

const grammarBank = grammarBankData as QuizQuestion[];

export function isQuizzableTopic(topicId: string): boolean {
  return grammarBank.some((item) => item.topicId === topicId);
}

// `excludeIds` keeps a session that draws the same topic in several batches
// (per-topic mode chunks 10 questions into 4/4/2) from re-serving an item
// the learner already answered — each call shuffles the whole topic pool.
export function generateQuestionsForTopic(
  topicId: string,
  count: number,
  excludeIds?: ReadonlySet<string>,
): QuizQuestion[] {
  const pool = grammarBank.filter(
    (item) => item.topicId === topicId && !excludeIds?.has(item.id),
  );
  return shuffle(pool).slice(0, count);
}

export function allQuizzableTopicIds(): string[] {
  return [...new Set(grammarBank.map((item) => item.topicId))];
}
