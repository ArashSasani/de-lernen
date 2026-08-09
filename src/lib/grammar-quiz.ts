import type { QuizQuestion } from '@/types/grammar-quiz';
import grammarBankData from '../../data/grammar-bank.json';
import { shuffle } from './shuffle';

const grammarBank = grammarBankData as QuizQuestion[];

export function isQuizzableTopic(topicId: string): boolean {
  return grammarBank.some((item) => item.topicId === topicId);
}

export function generateQuestionsForTopic(
  topicId: string,
  count: number,
): QuizQuestion[] {
  return shuffle(grammarBank.filter((item) => item.topicId === topicId)).slice(
    0,
    count,
  );
}

export function allQuizzableTopicIds(): string[] {
  return [...new Set(grammarBank.map((item) => item.topicId))];
}
