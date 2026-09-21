'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GRAMMAR_BATCH_SIZE_MAX } from '@/constants';
import type {
  GrammarQuizProgressMap,
  QuizQuestion,
} from '@/types/grammar-quiz';
import {
  selectQuizTopics,
  difficultyFor,
  type QuizPlan,
} from '@/app/grammar/quiz/page.helpers';
import { defaultGrammarQuizProgress } from '@/lib/grammar-quiz-sync';
import { sourceQuestions } from '@/lib/grammar-quiz-ai';
import { generateQuestionsForTopic } from '@/lib/grammar-quiz';
import { getToken } from '@/lib/sync';
import { useOnline } from './useOnline';

export type QuizPhase =
  | 'booting'
  | 'loading-first'
  | 'active'
  | 'waiting-batch'
  | 'empty'
  | 'finished';

const WAITING_BATCH_TIMEOUT_MS = 2500;

// A single-topic session is served as several same-topic batches (batch =
// one topic, sized to the AI's 3-4 range) rather than one big request, so
// later batches can prefetch while the learner answers the first.
function chunkedTopicPlan(
  topicId: string,
  count: number,
  progress: GrammarQuizProgressMap,
): QuizPlan[] {
  const p = progress[topicId] ?? defaultGrammarQuizProgress();
  const difficulty = difficultyFor(p);
  const plan: QuizPlan[] = [];
  let remaining = count;
  while (remaining > 0) {
    const chunk = Math.min(GRAMMAR_BATCH_SIZE_MAX, remaining);
    plan.push({ topicId, count: chunk, tier: 3, difficulty });
    remaining -= chunk;
  }
  return plan;
}

export interface UseQuizQueueOptions {
  topicId: string | null;
  topicCount?: number; // per-topic mode's total question count (default 10)
  progress: GrammarQuizProgressMap;
  // Resolved by the caller: AI toggle on && a key is configured on this
  // deployment. Read per batch, so flipping it mid-session changes where
  // the *next* batch comes from without disturbing the current one.
  aiEnabled: boolean;
  getNotes?: (topicId: string) => string[];
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

export function useQuizQueue(opts: UseQuizQueueOptions): QuizQueueApi {
  const { topicId, progress, aiEnabled } = opts;
  const topicCount = opts.topicCount ?? 10;
  const online = useOnline();

  const [phase, setPhase] = useState<QuizPhase>('booting');
  const [queue, setQueue] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [loadedBatches, setLoadedBatches] = useState(0);
  const [total, setTotal] = useState(0);
  const [planLength, setPlanLength] = useState(0);

  // Every value the fetch chain reads lives in a ref, never in a dependency
  // array: `progress` is replaced on each graded answer, and `online` flips
  // with connectivity, so depending on either would restart the session
  // mid-run. Refs are written in effects and read only inside callbacks.
  const runIdRef = useRef(0);
  const planRef = useRef<QuizPlan[]>([]);
  const seenRef = useRef<Map<string, string[]>>(new Map());
  const servedBankIdsRef = useRef<Set<string>>(new Set());
  const aiAllowedRef = useRef(aiEnabled);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<boolean[]>([]);
  const progressRef = useRef(progress);
  const aiEnabledRef = useRef(aiEnabled);
  const onlineRef = useRef(online);
  const getNotesRef = useRef(opts.getNotes);
  // Guards against a slow real fetch and the waiting-batch timeout fallback
  // both appending the same batch index.
  const appendedRef = useRef<Set<number>>(new Set());
  // Mirrors queue.length for the async chain, which must not read state.
  const queueLenRef = useRef(0);
  const loadFromRef = useRef<(batchIdx: number) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    getNotesRef.current = opts.getNotes;
  }, [opts.getNotes]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    aiEnabledRef.current = aiEnabled;
  }, [aiEnabled]);

  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  // Bank picks are recorded so a later same-topic batch can exclude them —
  // each generateQuestionsForTopic call reshuffles the whole topic pool, so
  // per-topic mode's 4/4/2 chunks would otherwise repeat questions.
  const fromBankExcludingServed = useCallback(
    (id: string, count: number): QuizQuestion[] => {
      const qs = generateQuestionsForTopic(id, count, servedBankIdsRef.current);
      for (const q of qs) servedBankIdsRef.current.add(q.id);
      return qs;
    },
    [],
  );

  const fetchBatch = useCallback(
    async (
      id: number,
      p: QuizPlan,
      signal: AbortSignal,
    ): Promise<QuizQuestion[]> => {
      const token = getToken();
      // Not latched: a two-second connectivity blip must not downgrade the
      // rest of the session. Only a real AI failure sets aiAllowedRef false.
      if (
        !aiEnabledRef.current ||
        !aiAllowedRef.current ||
        !onlineRef.current
      ) {
        return fromBankExcludingServed(p.topicId, p.count);
      }
      if (!token) {
        return fromBankExcludingServed(p.topicId, p.count);
      }
      const alreadyAsked = seenRef.current.get(p.topicId) ?? [];
      const notes = getNotesRef.current?.(p.topicId) ?? [];
      const recentResults = resultsRef.current.slice(-6);
      // Re-derived per batch, not taken from the plan: the plan is built
      // before the session has any results, so a learner on a hot streak
      // would otherwise be served the difficulty they started at.
      const adapted: QuizPlan = {
        ...p,
        difficulty: difficultyFor(
          progressRef.current[p.topicId] ?? defaultGrammarQuizProgress(),
          recentResults,
        ),
      };
      const result = await sourceQuestions(adapted, {
        token,
        signal,
        alreadyAsked,
        recentResults,
        notes,
        excludeIds: servedBankIdsRef.current,
      });
      if (result.degraded) {
        aiAllowedRef.current = false;
        if (runIdRef.current === id) setDegraded(true);
      }
      for (const q of result.questions) servedBankIdsRef.current.add(q.id);
      seenRef.current.set(p.topicId, [
        ...alreadyAsked,
        ...result.questions.map((q) => q.prompt),
      ]);
      return result.questions;
    },
    [fromBankExcludingServed],
  );

  const runOnce = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Always a fresh id, so any batch still in flight for the previous run
    // fails its `runIdRef.current !== id` guard instead of appending into
    // the queue this run is about to build.
    runIdRef.current += 1;
    const id = runIdRef.current;

    const snapshot = progressRef.current;
    const plan = topicId
      ? chunkedTopicPlan(topicId, topicCount, snapshot)
      : selectQuizTopics(snapshot);
    planRef.current = plan;
    aiAllowedRef.current = aiEnabledRef.current;
    seenRef.current = new Map();
    servedBankIdsRef.current = new Set();
    resultsRef.current = [];
    appendedRef.current = new Set();
    queueLenRef.current = 0;

    setPlanLength(plan.length);
    setTotal(plan.reduce((sum, p) => sum + p.count, 0));
    setQueue([]);
    setIndex(0);
    setResults([]);
    setDegraded(false);
    setLoadedBatches(0);

    if (plan.length === 0) {
      setPhase('empty');
      return;
    }
    setPhase('loading-first');

    // Chained, not parallel: batch N+1 starts only once batch N's fetch
    // resolves, so it can react to that batch's `degraded` state, and
    // counts as "prefetched while answering batch N" for a learner who
    // takes any time at all to answer 3-4 questions. Guarded by
    // appendedRef so a slow real fetch racing the waiting-batch timeout
    // fallback (below) can't append the same batch twice.
    const loadFrom = async (batchIdx: number) => {
      if (batchIdx >= plan.length) return;
      const qs = await fetchBatch(id, plan[batchIdx], controller.signal);
      if (runIdRef.current !== id || appendedRef.current.has(batchIdx)) {
        return;
      }
      appendedRef.current.add(batchIdx);
      queueLenRef.current += qs.length;
      setQueue((q) => [...q, ...qs]);
      setLoadedBatches(batchIdx + 1);
      if (queueLenRef.current > 0) {
        setPhase((prev) =>
          prev === 'loading-first' || prev === 'waiting-batch'
            ? 'active'
            : prev,
        );
      } else if (batchIdx + 1 >= plan.length) {
        // A topic with no bank items and no reachable generator yields
        // nothing; without this the page sits on the batch skeleton
        // forever instead of offering another topic.
        setPhase('empty');
      }
      void loadFrom(batchIdx + 1);
    };
    loadFromRef.current = loadFrom;

    // Batch 0 is served from the bank synchronously so the first question is
    // on screen immediately — generating it takes seconds, and a spinner is
    // the worst possible use of the one moment the learner is most ready to
    // answer. Generation starts at batch 1 and has the whole of batch 0's
    // answering time to land.
    const starter = fromBankExcludingServed(plan[0].topicId, plan[0].count);
    // Per-topic mode draws every batch from one topic, so the generator has
    // to see the starter's prompts or batch 1 can reword one of them.
    seenRef.current.set(
      plan[0].topicId,
      starter.map((q) => q.prompt),
    );
    appendedRef.current.add(0);
    queueLenRef.current = starter.length;
    setQueue(starter);
    setLoadedBatches(1);
    if (starter.length > 0) {
      setPhase('active');
    } else if (plan.length === 1) {
      setPhase('empty');
    }
    void loadFrom(1);
  }, [topicId, topicCount, fetchBatch, fromBankExcludingServed]);

  useEffect(() => {
    runOnce();
    return () => {
      abortRef.current?.abort();
    };
  }, [runOnce]);

  // A learner who outruns every prefetch falls back to the bank after a
  // short wait rather than staring at a spinner indefinitely.
  useEffect(() => {
    if (phase !== 'waiting-batch') return;
    const id = runIdRef.current;
    const batchIdx = loadedBatches;
    const timer = setTimeout(() => {
      if (runIdRef.current !== id || appendedRef.current.has(batchIdx)) return;
      const p = planRef.current[batchIdx];
      if (!p) return;
      // This batch only — the generator is not disabled for the rest of the
      // run. Outrunning one slow response is ordinary, and latching here
      // turned a single stall into an all-bank session.
      appendedRef.current.add(batchIdx);
      setDegraded(true);
      const qs = fromBankExcludingServed(p.topicId, p.count);
      queueLenRef.current += qs.length;
      setQueue((q) => [...q, ...qs]);
      setLoadedBatches(batchIdx + 1);
      if (queueLenRef.current > 0) setPhase('active');
      void loadFromRef.current(batchIdx + 1);
    }, WAITING_BATCH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase, loadedBatches, fromBankExcludingServed]);

  const recordResult = useCallback((correct: boolean) => {
    setResults((r) => [...r, correct]);
  }, []);

  // Phase transitions past the initial load are decided here, at the point
  // the learner advances, rather than in a derived-state effect: whether
  // the next question is already loaded, still loading, or the session is
  // over is exactly the question `next()` itself needs answered.
  const next = useCallback(() => {
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex < queue.length) {
      setPhase('active');
    } else if (loadedBatches >= planRef.current.length) {
      setPhase(queue.length === 0 ? 'empty' : 'finished');
    } else {
      setPhase('waiting-batch');
    }
  }, [index, queue.length, loadedBatches]);

  const restart = useCallback(() => {
    runOnce();
  }, [runOnce]);

  return {
    phase,
    current: queue[index] ?? null,
    index,
    // The plan is a request, not a promise: a short bank pool can return
    // fewer items, so once everything is loaded the queue is the truth.
    total:
      planLength > 0 && loadedBatches >= planLength
        ? queue.length
        : Math.max(total, queue.length),
    results,
    degraded,
    recordResult,
    next,
    restart,
  };
}
