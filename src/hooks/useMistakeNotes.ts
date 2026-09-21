'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Level } from '@/types';
import type { QuizQuestion } from '@/types/grammar-quiz';
import type {
  JudgeVerdict,
  MistakeCandidate,
  QuizMissContext,
} from '@/types/ai';
import {
  gateCandidate,
  gateCandidateWithJudge,
  type GroundTruth,
} from '@/lib/mistakes-gate';
import { parseJudgeVerdict, parseMistakeCandidate } from '@/lib/ai/validate';
import { getToken } from '@/lib/sync';
import { isJudgeEnabled } from '@/lib/ai-prefs';
import type { MistakesApi } from './useMistakes';
import { canAuthorNote } from './useMistakeNotes.helpers';

function quizMissContext(
  question: QuizQuestion,
  learnerAnswerIndex: number,
): QuizMissContext {
  return {
    topicId: question.topicId,
    prompt: question.prompt,
    choices: question.choices,
    correctIndex: question.correctIndex,
    ...(question.acceptableIndices
      ? { acceptableIndices: question.acceptableIndices }
      : {}),
    learnerAnswerIndex,
    explanation: question.explanation,
  };
}

function groundTruth(
  question: QuizQuestion,
  learnerAnswerIndex: number,
): GroundTruth {
  return {
    kind: 'grammar-quiz',
    topicId: question.topicId,
    itemId: question.id,
    level: question.level,
    choices: question.choices,
    correctIndex: question.correctIndex,
    ...(question.acceptableIndices
      ? { acceptableIndices: question.acceptableIndices }
      : {}),
    learnerAnswerIndex,
  };
}

// Every note either lands or is dropped silently, so without this there is
// no way to tell an over-cautious model from a broken pipeline. Dev only.
function trace(topicId: string, outcome: string): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info(`[mistakes] ${topicId} — ${outcome}`);
}

async function postAi<T>(token: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function judge(
  token: string,
  level: Level,
  quiz: QuizMissContext,
  candidate: MistakeCandidate,
): Promise<JudgeVerdict | null> {
  const raw = await postAi<unknown>(token, {
    intent: 'judge',
    level,
    quiz,
    candidate: { text: candidate.text },
  });
  return raw ? parseJudgeVerdict(raw) : null;
}

// The mistakes corpus's first producer. Fire-and-forget so the quiz card
// never waits on it: on a miss, checks + reserves the per-session budget
// synchronously (before any fetch), POSTs the `note` intent, runs the gate
// (or the judge-augmented gate, per the Settings pref), and inserts via the
// caller's single `useMistakes()` instance if the verdict is `insert`.
// `aiEnabled` is the caller's resolved flag (Settings toggle && a key is
// configured), the same one the quiz queue uses. Authoring is a paid model
// call, so it has to honour the toggle: gating only question generation
// would leave "AI off" still spending on every miss.
export function useMistakeNotes(mistakesApi: MistakesApi, aiEnabled: boolean) {
  const attemptedTopics = useRef<Set<string>>(new Set());
  const authored = useRef(0);
  const aiEnabledRef = useRef(aiEnabled);

  useEffect(() => {
    aiEnabledRef.current = aiEnabled;
  }, [aiEnabled]);

  const recordMiss = useCallback(
    (question: QuizQuestion, learnerAnswerIndex: number) => {
      if (!aiEnabledRef.current) {
        trace(question.topicId, 'skipped: AI off');
        return;
      }
      if (
        !canAuthorNote(
          attemptedTopics.current,
          authored.current,
          question.topicId,
        )
      ) {
        trace(question.topicId, 'skipped: session budget');
        return;
      }
      attemptedTopics.current.add(question.topicId);

      const token = getToken();
      if (!token) {
        trace(question.topicId, 'skipped: no token');
        return;
      }

      const quiz = quizMissContext(question, learnerAnswerIndex);
      const truth = groundTruth(question, learnerAnswerIndex);

      // Deliberately not aborted on unmount: authoring takes seconds, and
      // the payoff is an IndexedDB write, not a render. Cancelling when the
      // learner leaves the page would drop exactly the note from their last
      // miss — the one most worth keeping.
      void (async () => {
        const raw = await postAi<unknown>(token, {
          intent: 'note',
          level: question.level,
          quiz,
        });
        if (!raw) {
          trace(question.topicId, 'no note: /api/ai returned nothing');
          return;
        }
        const candidate = parseMistakeCandidate(raw);
        if (!candidate) {
          trace(question.topicId, 'no note: model output failed validation');
          return;
        }

        const now = Date.now();
        const decision = isJudgeEnabled()
          ? await gateCandidateWithJudge(candidate, truth, now, (c) =>
              judge(token, question.level, quiz, c),
            )
          : gateCandidate(candidate, truth, now);

        if (decision.verdict === 'insert') {
          authored.current += 1;
          mistakesApi.addRecord(decision.record);
          trace(question.topicId, `saved: "${decision.record.text}"`);
          return;
        }
        trace(
          question.topicId,
          `rejected: ${decision.reason} (confidence ${candidate.confidence})`,
        );
      })();
    },
    [mistakesApi],
  );

  return { recordMiss };
}
