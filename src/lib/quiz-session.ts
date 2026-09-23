import { GRAMMAR_BATCH_SIZE_MAX } from '@/constants';
import type {
  GrammarQuizProgressMap,
  QuizEvent,
  QuizPhase,
  QuizPlan,
  QuizState,
} from '@/types/grammar-quiz';
import {
  difficultyFor,
  selectQuizTopics,
} from '@/app/grammar/quiz/page.helpers';
import { bankPoolSize } from './grammar-quiz';
import { defaultGrammarQuizProgress } from './grammar-quiz-sync';

// A grammar-quiz session as data: a reducer over batch arrivals and learner
// moves, plus selectors. No React, no I/O — lib/quiz-runner.ts feeds it events.

export const initialQuizState: QuizState = {
  plan: null,
  queue: [],
  index: 0,
  results: [],
  landedBatches: new Set(),
  filledBatches: new Set(),
  degraded: false,
};

function withAdded(set: ReadonlySet<number>, n: number): ReadonlySet<number> {
  return new Set(set).add(n);
}

export function quizReducer(state: QuizState, event: QuizEvent): QuizState {
  switch (event.type) {
    case 'started':
      // Batch 0 is the bank-drawn starter, so it has landed by definition.
      return {
        ...initialQuizState,
        plan: event.plan,
        queue: event.starter,
        landedBatches: event.plan.length > 0 ? new Set([0]) : new Set(),
      };
    case 'batch-landed':
      if (state.landedBatches.has(event.batchIdx)) return state;
      return {
        ...state,
        queue: [...state.queue, ...event.questions],
        landedBatches: withAdded(state.landedBatches, event.batchIdx),
      };
    case 'filler-landed':
      // Filler supplements a slot, never claims it: the real batch still appends.
      if (
        state.landedBatches.has(event.batchIdx) ||
        state.filledBatches.has(event.batchIdx)
      ) {
        return state;
      }
      return {
        ...state,
        queue: [...state.queue, ...event.questions],
        filledBatches: withAdded(state.filledBatches, event.batchIdx),
      };
    case 'degraded':
      return state.degraded ? state : { ...state, degraded: true };
    case 'answered':
      return { ...state, results: [...state.results, event.correct] };
    case 'advanced':
      return { ...state, index: state.index + 1 };
  }
}

function allBatchesLanded(state: QuizState): boolean {
  return state.plan !== null && state.landedBatches.size >= state.plan.length;
}

// Order matters: each check assumes the ones above it failed.
export function phaseOf(state: QuizState): QuizPhase {
  if (state.plan === null) return 'booting';
  const loaded = allBatchesLanded(state);
  if (state.queue.length === 0 && loaded) return 'empty';
  if (state.index < state.queue.length) return 'active';
  if (state.queue.length === 0) return 'loading-first';
  if (loaded) return 'finished';
  return 'waiting-batch';
}

// The plan is a request, not a promise: once every batch has landed, the
// queue is the truth (a short bank pool can serve fewer than planned).
export function totalOf(state: QuizState): number {
  if (state.plan === null) return 0;
  if (allBatchesLanded(state)) return state.queue.length;
  const requested = state.plan.reduce((n, p) => n + p.count, 0);
  return Math.max(requested, state.queue.length);
}

// Batches land in plan order, so the landed set is always 0..k-1.
export function nextFillIndex(state: QuizState): number {
  return state.landedBatches.size;
}

// Per-topic sessions are several same-topic batches so later ones prefetch.
// With AI off the total clamps to the bank pool, which can't fill 10 unrepeated.
function chunkedTopicPlan(
  topicId: string,
  count: number,
  progress: GrammarQuizProgressMap,
  aiEnabled: boolean,
): QuizPlan[] {
  const difficulty = difficultyFor(
    progress[topicId] ?? defaultGrammarQuizProgress(),
  );
  const plan: QuizPlan[] = [];
  let remaining = aiEnabled ? count : Math.min(count, bankPoolSize(topicId));
  while (remaining > 0) {
    const chunk = Math.min(GRAMMAR_BATCH_SIZE_MAX, remaining);
    plan.push({ topicId, count: chunk, tier: 3, difficulty });
    remaining -= chunk;
  }
  return plan;
}

export function planFor(
  topicId: string | null,
  topicCount: number,
  progress: GrammarQuizProgressMap,
  aiEnabled: boolean,
): QuizPlan[] {
  return topicId
    ? chunkedTopicPlan(topicId, topicCount, progress, aiEnabled)
    : selectQuizTopics(progress);
}
