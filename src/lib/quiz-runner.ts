'use client';

import type {
  QuizEvent,
  QuizPlan,
  QuizQuestion,
  QuizRunContext,
} from '@/types/grammar-quiz';
import { difficultyFor } from '@/app/grammar/quiz/page.helpers';
import { sourceQuestions, type SourceResult } from './grammar-quiz-ai';
import { generateQuestionsForTopic } from './grammar-quiz';
import { getServedAt, markServed } from './bank-rotation';
import { defaultGrammarQuizProgress } from './grammar-quiz-sync';
import { getToken } from './sync';

// The async half of a grammar-quiz session: sources each planned batch (AI or
// bank) and reports arrivals as QuizEvents. No React; lib/quiz-session.ts reduces.

export const NOTES_READY_TIMEOUT_MS = 2000;
const RECENT_RESULTS = 6;

export interface Latch {
  open: () => void;
  // Resolves when opened, or after `ms` — whichever is first.
  wait: (ms: number) => Promise<void>;
}

export function createLatch(initiallyOpen = false): Latch {
  let isOpen = initiallyOpen;
  let waiters: (() => void)[] = [];
  return {
    open() {
      isOpen = true;
      for (const resolve of waiters) resolve();
      waiters = [];
    },
    wait(ms) {
      if (isOpen) return Promise.resolve();
      return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
}

export interface BankCursor {
  // Bank items for a topic, never repeating one already served this run.
  draw: (topicId: string, count: number) => QuizQuestion[];
  // Books a sourcer result: in-session dedupe, plus rotation for bank picks.
  absorb: (result: SourceResult) => void;
  served: ReadonlySet<string>;
  servedAt: ReadonlyMap<string, number>;
}

// servedAt is snapshotted once, so ordering stays stable while markServed writes.
export function createBankCursor(): BankCursor {
  const served = new Set<string>();
  const servedAt = getServedAt();
  return {
    served,
    servedAt,
    draw(topicId, count) {
      const qs = generateQuestionsForTopic(topicId, count, served, servedAt);
      for (const q of qs) served.add(q.id);
      markServed(qs.map((q) => q.id));
      return qs;
    },
    absorb(result) {
      for (const q of result.questions) served.add(q.id);
      if (result.source === 'bank')
        markServed(result.questions.map((q) => q.id));
    },
  };
}

export interface RunOptions {
  plan: QuizPlan[];
  getContext: () => QuizRunContext;
  // Only events from a live run reach the reducer; the caller scopes this.
  dispatch: (event: QuizEvent) => void;
  signal: AbortSignal;
  notes: Latch;
}

export interface QuizRun {
  // Bank filler for a slot the learner outran; the real batch still lands.
  fill: (batchIdx: number) => void;
}

export function startRun({
  plan,
  getContext,
  dispatch,
  signal,
  notes,
}: RunOptions): QuizRun {
  const cursor = createBankCursor();
  const seen = new Map<string, string[]>();
  // Latched off by a real generator failure only, never by a connectivity blip.
  let aiAllowed = getContext().aiEnabled;

  const remember = (topicId: string, qs: QuizQuestion[]) => {
    seen.set(topicId, [
      ...(seen.get(topicId) ?? []),
      ...qs.map((q) => q.prompt),
    ]);
  };

  const fetchBatch = async (p: QuizPlan): Promise<QuizQuestion[]> => {
    const token = getToken();
    const { aiEnabled, online } = getContext();
    if (!aiEnabled || !aiAllowed || !online || !token) {
      return cursor.draw(p.topicId, p.count);
    }
    // Batch 0 is on screen while this waits, so the delay is invisible.
    await notes.wait(NOTES_READY_TIMEOUT_MS);
    const ctx = getContext();
    const recentResults = ctx.results.slice(-RECENT_RESULTS);
    // Re-derived per batch so a hot streak escalates mid-session.
    const difficulty = difficultyFor(
      ctx.progress[p.topicId] ?? defaultGrammarQuizProgress(),
      recentResults,
    );
    const result = await sourceQuestions(
      { ...p, difficulty },
      {
        token,
        signal,
        alreadyAsked: seen.get(p.topicId) ?? [],
        recentResults,
        notes: ctx.getNotes?.(p.topicId) ?? [],
        excludeIds: cursor.served,
        servedAt: cursor.servedAt,
      },
    );
    // An aborted fetch reads as degraded; a dead run must not act on it.
    if (signal.aborted) return [];
    if (result.degraded) {
      aiAllowed = false;
      dispatch({ type: 'degraded' });
    }
    cursor.absorb(result);
    return result.questions;
  };

  // Chained, not parallel: batch N+1 starts once N resolves, so it sees N's degraded state.
  const loadFrom = async (batchIdx: number): Promise<void> => {
    if (batchIdx >= plan.length || signal.aborted) return;
    const questions = await fetchBatch(plan[batchIdx]);
    if (signal.aborted) return;
    remember(plan[batchIdx].topicId, questions);
    dispatch({ type: 'batch-landed', batchIdx, questions });
    await loadFrom(batchIdx + 1);
  };

  // Batch 0 comes from the bank synchronously, so the first question never waits.
  const starter =
    plan.length > 0 ? cursor.draw(plan[0].topicId, plan[0].count) : [];
  if (plan.length > 0) remember(plan[0].topicId, starter);
  dispatch({ type: 'started', plan, starter });
  void loadFrom(1);

  return {
    fill(batchIdx) {
      const p = plan[batchIdx];
      if (!p || signal.aborted) return;
      const questions = cursor.draw(p.topicId, p.count);
      remember(p.topicId, questions);
      dispatch({ type: 'filler-landed', batchIdx, questions });
    },
  };
}
