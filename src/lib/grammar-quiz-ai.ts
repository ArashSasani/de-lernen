'use client';

import {
  AI_QUESTION_ID_PREFIX,
  GRAMMAR_BATCH_SIZE_MAX,
  GRAMMAR_BATCH_SIZE_MIN,
} from '@/constants';
import type { Level } from '@/types';
import type { QuizPlan, QuizQuestion } from '@/types/grammar-quiz';
import type { GeneratedQuizItem } from '@/types/ai';
import { generateQuestionsForTopic } from './grammar-quiz';
import { grammarTopicById } from './grammar';
import { getLearnerLevel } from './ai-prefs';
import { parseGeneratedQuestions } from './ai/validate';

export interface SourceOptions {
  token: string;
  signal?: AbortSignal;
  recentResults?: boolean[];
  alreadyAsked?: string[];
  notes?: string[];
  excludeIds?: ReadonlySet<string>; // bank ids already served this session
  servedAt?: ReadonlyMap<string, number>; // cross-session bank rotation
}

// The one place that decides whether a question came from the generator or
// the frozen bank — the id prefix is stamped by stampQuestions and is the
// only marker that survives into the card.
export function isAiGenerated(question: { id: string }): boolean {
  return question.id.startsWith(AI_QUESTION_ID_PREFIX);
}

export interface SourceResult {
  questions: QuizQuestion[];
  source: 'bank' | 'ai';
  degraded: boolean;
}

function fromBank(plan: QuizPlan, opts: SourceOptions): SourceResult {
  return {
    questions: generateQuestionsForTopic(
      plan.topicId,
      plan.count,
      opts.excludeIds,
      opts.servedAt,
    ),
    source: 'bank',
    degraded: false,
  };
}

// `ai-<topicId>-<uuid8>` — the prefix and hex suffix can't collide with the
// bank's `<slug>-<2 digits>` id shape.
function stampQuestions(
  items: GeneratedQuizItem[],
  plan: QuizPlan,
  level: Level,
): QuizQuestion[] {
  return items.map((item) => ({
    id: `ai-${plan.topicId}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    topicId: plan.topicId,
    level,
    difficulty: plan.difficulty,
    prompt: item.prompt,
    choices: item.choices,
    correctIndex: item.correctIndex,
    acceptableIndices: item.acceptableIndices,
    explanation: item.explanation,
  }));
}

// Never throws: not online (no token) → bank; otherwise try /api/ai,
// validate every item, and on any failure/abort/invalid shape return the
// bank slice with degraded: true. All error handling lives here, so
// useQuizQueue has no error branch for sourcing.
export async function sourceQuestions(
  plan: QuizPlan,
  opts: SourceOptions,
): Promise<SourceResult> {
  const topic = grammarTopicById(plan.topicId);
  if (!topic) return fromBank(plan, opts);

  const batchSize = Math.max(
    GRAMMAR_BATCH_SIZE_MIN,
    Math.min(GRAMMAR_BATCH_SIZE_MAX, plan.count),
  );

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'grammar',
        level: topic.level,
        learnerLevel: getLearnerLevel(),
        topicId: plan.topicId,
        batchSize,
        difficulty: plan.difficulty,
        ...(opts.recentResults?.length
          ? { recentResults: opts.recentResults }
          : {}),
        ...(opts.alreadyAsked?.length
          ? { alreadyAsked: opts.alreadyAsked }
          : {}),
        ...(opts.notes?.length ? { notes: opts.notes } : {}),
      }),
      signal: opts.signal,
    });
    if (!res.ok) return { ...fromBank(plan, opts), degraded: true };

    const data = await res.json().catch(() => null);
    // Re-validated client-side too, against the same rules the server
    // already applied — a shape drift between client and server builds
    // must not reach the card unchecked.
    const items = parseGeneratedQuestions(data);
    if (items.length === 0) return { ...fromBank(plan, opts), degraded: true };

    const questions = stampQuestions(items, plan, topic.level);
    if (questions.length < plan.count) {
      const topUp = generateQuestionsForTopic(
        plan.topicId,
        plan.count - questions.length,
        opts.excludeIds,
        opts.servedAt,
      );
      return {
        questions: [...questions, ...topUp],
        source: 'ai',
        degraded: false,
      };
    }
    // The request pads batchSize up to the AI minimum (3), which can
    // exceed a smart-mix slice's plan.count (as low as 1-2) — trimmed back
    // to what the plan actually asked for so totalRef stays predictable.
    return {
      questions: questions.slice(0, plan.count),
      source: 'ai',
      degraded: false,
    };
  } catch {
    // Offline, aborted, or a network error — degrade to the bank silently.
    return { ...fromBank(plan, opts), degraded: true };
  }
}
