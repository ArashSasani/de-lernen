import type { QuizQuestion } from '@/types/grammar-quiz';

// Grades against every genuinely correct choice, not just correctIndex.
// Defaults to [correctIndex] when the field is absent (every bank item).
export function isAcceptable(
  question: QuizQuestion,
  choiceIndex: number,
): boolean {
  const acceptable = question.acceptableIndices ?? [question.correctIndex];
  return acceptable.includes(choiceIndex);
}

// The alternative to name in the result panel when the learner picked an
// acceptable choice other than correctIndex — null when there isn't one.
export function alternativeChoice(
  question: QuizQuestion,
  selected: number,
): string | null {
  if (selected === question.correctIndex) return null;
  if (!isAcceptable(question, selected)) return null;
  return question.choices[question.correctIndex];
}

export function choiceStyle(
  answered: boolean,
  i: number,
  selected: number | null,
  correctIndex: number,
  acceptableIndices?: number[],
): string {
  if (!answered) {
    return 'border-base-300 bg-base-200 text-base-content/80 hover:bg-base-300';
  }
  const acceptable = acceptableIndices ?? [correctIndex];
  if (acceptable.includes(i)) {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 light:text-emerald-700';
  }
  if (i === selected) {
    return 'border-rose-400/30 bg-rose-500/10 text-rose-300 light:text-rose-700';
  }
  return 'border-base-300/50 bg-base-200/50 text-base-content/60';
}
