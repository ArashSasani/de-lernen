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
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
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
import type { QuizQuestion } from '@/types/grammar-quiz';
import { buildSmartQuiz, buildTopicQuiz, sessionStats } from './page.helpers';
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
  const [queue, setQueue] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadGrammarQuizProgress().then(async (local) => {
      setProgress(local);
      const merged = await fullGrammarQuizSync(local);
      setProgress(merged);
      const q = topicId ? buildTopicQuiz(topicId) : buildSmartQuiz(merged);
      setQueue(q);
      startTransition(() => setReady(true));
    });
  }, [router, setProgress, topicId]);

  const current = queue[index];

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (!current) return;
      recordAttempt(current.topicId, correct);
      setResults((r) => [...r, correct]);
    },
    [current, recordAttempt],
  );

  const handleNext = useCallback(() => setIndex((i) => i + 1), []);

  const practiceAgain = useCallback(() => {
    const q = topicId ? buildTopicQuiz(topicId) : buildSmartQuiz(progress);
    setQueue(q);
    setIndex(0);
    setResults([]);
  }, [progress, topicId]);

  const topic = topicId ? grammarTopicById(topicId) : null;
  const title = topic ? topic.title : 'Grammatik-Quiz';
  const backHref = topic
    ? `/grammar?open=${topic.category}&topic=${topicId}`
    : '/grammar';

  if (!ready) {
    return <LoadingScreen />;
  }

  if (queue.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6 md:max-w-5xl md:gap-8 md:px-10 md:py-10">
        <header className="flex items-baseline justify-between">
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
        </header>
        <p className="text-base-content/60 text-sm">
          Please try a different topic.
        </p>
      </main>
    );
  }

  const finished = index >= queue.length;
  const stats = sessionStats(results);

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
        {finished ? (
          <SessionSummary
            heading={`${stats.correct}/${stats.total}`}
            subheading={`${stats.pct}% richtig`}
            actionLabel="Practice again"
            onAction={practiceAgain}
          />
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-3">
            <p className="text-base-content/60 text-right text-xs">
              {index + 1} / {queue.length}
            </p>
            <GrammarQuizCard
              key={`${index}-${current.prompt}`}
              question={current}
              onAnswer={handleAnswer}
              onNext={handleNext}
            />
          </div>
        )}
      </section>
    </main>
  );
}
