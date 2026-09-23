'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type {
  GrammarQuizProgressMap,
  QuizEvent,
  QuizPhase,
  QuizQuestion,
  QuizRunContext,
} from '@/types/grammar-quiz';
import {
  initialQuizState,
  nextFillIndex,
  phaseOf,
  planFor,
  quizReducer,
  totalOf,
} from '@/lib/quiz-session';
import { createLatch, startRun, type QuizRun } from '@/lib/quiz-runner';
import { useOnline } from './useOnline';

// How long a learner who outran the prefetch waits before bank filler bridges the gap.
const WAITING_BATCH_TIMEOUT_MS = 2500;

export interface UseQuizQueueOptions {
  topicId: string | null;
  topicCount?: number; // per-topic mode's total question count (default 10)
  progress: GrammarQuizProgressMap;
  // AI toggle && a key configured. Read per batch: a flip changes the next batch only.
  aiEnabled: boolean;
  getNotes?: (topicId: string) => string[];
  // Whether getNotes sees the IndexedDB corpus yet; generation waits (bounded) for it.
  notesReady?: boolean;
}

export interface QuizQueueApi {
  phase: QuizPhase;
  current: QuizQuestion | null;
  index: number;
  total: number;
  results: boolean[];
  degraded: boolean;
  recordResult: (correct: boolean) => void;
  next: () => void;
  restart: () => void;
}

// React adapter over lib/quiz-session.ts (state) and lib/quiz-runner.ts (sourcing).
export function useQuizQueue(opts: UseQuizQueueOptions): QuizQueueApi {
  const { topicId, progress, aiEnabled, getNotes } = opts;
  const topicCount = opts.topicCount ?? 10;
  const notesReady = opts.notesReady ?? true;
  const online = useOnline();

  const [state, dispatch] = useReducer(quizReducer, initialQuizState);
  const [runToken, setRunToken] = useState(0);
  const runRef = useRef<QuizRun | null>(null);
  const [notes] = useState(() => createLatch(notesReady));

  // Live values the run reads per batch; in a ref so changes never restart it.
  const ctxRef = useRef<QuizRunContext>({
    progress,
    aiEnabled,
    online,
    results: state.results,
    getNotes,
  });
  useEffect(() => {
    ctxRef.current = {
      progress,
      aiEnabled,
      online,
      results: state.results,
      getNotes,
    };
    if (notesReady) notes.open();
  });

  useEffect(() => {
    const controller = new AbortController();
    // The reducer clears results on `started`, but the next render may land after batch 1 reads them.
    const ctx = (ctxRef.current = { ...ctxRef.current, results: [] });
    runRef.current = startRun({
      plan: planFor(topicId, topicCount, ctx.progress, ctx.aiEnabled),
      getContext: () => ctxRef.current,
      dispatch: (event: QuizEvent) => {
        if (!controller.signal.aborted) dispatch(event);
      },
      signal: controller.signal,
      notes,
    });
    return () => controller.abort();
  }, [topicId, topicCount, runToken, notes]);

  const phase = phaseOf(state);
  const fillIndex = nextFillIndex(state);
  useEffect(() => {
    if (phase !== 'waiting-batch') return;
    const timer = setTimeout(
      () => runRef.current?.fill(fillIndex),
      WAITING_BATCH_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, fillIndex]);

  const recordResult = useCallback(
    (correct: boolean) => dispatch({ type: 'answered', correct }),
    [],
  );
  const next = useCallback(() => dispatch({ type: 'advanced' }), []);
  const restart = useCallback(() => setRunToken((t) => t + 1), []);

  return {
    phase,
    current: state.queue[state.index] ?? null,
    index: state.index,
    total: totalOf(state),
    results: state.results,
    degraded: state.degraded,
    recordResult,
    next,
    restart,
  };
}
