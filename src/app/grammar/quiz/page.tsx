'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  startTransition,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import AppNav from '@/components/AppNav';
import GrammarQuizCard from '@/components/GrammarQuizCard';
import SessionSummary from '@/components/shared/SessionSummary';
import { getToken } from '@/lib/sync';
import {
  loadGrammarQuizProgress,
  useGrammarQuizSync,
} from '@/hooks/useGrammarQuizSync';
import { fullGrammarQuizSync } from '@/lib/grammar-quiz-sync';
import { grammarTopicById } from '@/lib/grammar';
import { useAiConfigured } from '@/hooks/useAiConfigured';
import { useMistakes } from '@/hooks/useMistakes';
import { useMistakeNotes } from '@/hooks/useMistakeNotes';
import { useQuizQueue } from '@/hooks/useQuizQueue';
import { isAiEnabled } from '@/lib/ai-prefs';
import { notesForPrompt } from '@/lib/mistakes-prompt';
import type { GrammarQuizProgressMap } from '@/types/grammar-quiz';
import { sessionStats } from './page.helpers';
import LoadingScreen from '@/components/shared/LoadingScreen';

export default function GrammarQuizPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GrammarQuizInner />
    </Suspense>
  );
}

function GrammarQuizInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get('topic');

  const { progress, setProgress, recordAttempt } = useGrammarQuizSync();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadGrammarQuizProgress().then(async (local) => {
      setProgress(local);
      const merged = await fullGrammarQuizSync(local);
      setProgress(merged);
      startTransition(() => setReady(true));
    });
  }, [router, setProgress]);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <GrammarQuizSession
      topicId={topicId}
      progress={progress}
      recordAttempt={recordAttempt}
    />
  );
}

function GrammarQuizSession({
  topicId,
  progress,
  recordAttempt,
}: {
  topicId: string | null;
  progress: GrammarQuizProgressMap;
  recordAttempt: (topicId: string, correct: boolean) => void;
}) {
  const router = useRouter();
  // Stable, or useAiConfigured's effect re-issues its GET on every render.
  const onUnauthorized = useCallback(() => router.replace('/login'), [router]);
  const aiConfigured = useAiConfigured(onUnauthorized);
  // One resolved flag for every paid call this page can make — question
  // generation and note authoring alike.
  const aiEnabled = aiConfigured && isAiEnabled();
  const mistakesApi = useMistakes();
  const { recordMiss } = useMistakeNotes(mistakesApi, aiEnabled);

  const getNotes = useCallback(
    (id: string) => notesForPrompt(mistakesApi.mistakes, [id]),
    [mistakesApi.mistakes],
  );

  const queue = useQuizQueue({
    topicId,
    progress,
    aiEnabled,
    getNotes,
    notesReady: mistakesApi.ready,
  });

  const { current, recordResult } = queue;
  const handleAnswer = useCallback(
    (correct: boolean, choiceIndex: number) => {
      if (!current) return;
      recordAttempt(current.topicId, correct);
      recordResult(correct);
      if (!correct) recordMiss(current, choiceIndex);
    },
    [current, recordResult, recordAttempt, recordMiss],
  );

  const topic = topicId ? grammarTopicById(topicId) : null;
  const title = topic ? topic.title : 'Grammatik-Quiz';
  const backHref = topic
    ? `/grammar?open=${topic.category}&topic=${topicId}`
    : '/grammar';

  if (queue.phase === 'booting' || queue.phase === 'loading-first') {
    return <LoadingScreen />;
  }

  const stats = sessionStats(queue.results);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6 md:max-w-5xl md:gap-8 md:px-10 md:py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="text-base-content/60 hover:text-base-content/80"
              aria-label="Back to grammar"
            >
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {title}
            </h1>
          </div>
          <AppNav />
        </div>
      </header>

      <section className="mt-2 flex flex-1 flex-col">
        {queue.phase === 'empty' && (
          <p className="text-base-content/60 text-sm">
            Please try a different topic.
          </p>
        )}

        {queue.phase === 'finished' && (
          <SessionSummary
            heading={`${stats.correct}/${stats.total}`}
            subheading={`${stats.pct}% richtig`}
            actionLabel="Practice again"
            onAction={queue.restart}
          />
        )}

        {(queue.phase === 'active' || queue.phase === 'waiting-batch') && (
          <div className="flex flex-1 flex-col justify-center gap-3">
            <div className="flex items-baseline justify-between gap-2">
              {queue.degraded ? (
                <span className="text-base-content/50 text-xs">
                  Offline-Fragenbank
                </span>
              ) : (
                <span />
              )}
              <p className="text-base-content/60 text-xs">
                {queue.index + 1} / {queue.total}
              </p>
            </div>
            {queue.phase === 'waiting-batch' || !queue.current ? (
              <div
                className="border-base-300 bg-base-200 flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border p-5"
                role="status"
                aria-live="polite"
              >
                <ArrowPathIcon
                  className="text-base-content/60 h-6 w-6 animate-spin"
                  aria-hidden="true"
                />
                <p className="text-base-content/60 text-sm">
                  Nächste Fragen werden geladen…
                </p>
              </div>
            ) : (
              <GrammarQuizCard
                key={`${queue.index}-${queue.current.prompt}`}
                question={queue.current}
                onAnswer={handleAnswer}
                onNext={queue.next}
              />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
