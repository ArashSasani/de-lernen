'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import AppNav from '@/components/AppNav';
import Chip from '@/components/shared/Chip';
import SessionSummary from '@/components/shared/SessionSummary';
import type { Word } from '@/types';
import { getToken } from '@/lib/sync';
import { generateGap } from '@/lib/dictation';
import type { Gap } from '@/lib/dictation';
import {
  loadDictationProgress,
  useDictationSync,
} from '@/hooks/useDictationSync';
import { fullDictationSync } from '@/lib/dictation-sync';
import { buildDictationQueue, sessionStats } from './page.helpers';
import DictationCard from '@/components/DictationCard';
import LoadingScreen from '@/components/shared/LoadingScreen';

export default function DictationPage() {
  const router = useRouter();
  const { progress, progressRef, setProgress, recordAttempt, toggleStar } =
    useDictationSync();
  const [ready, setReady] = useState(false);
  const [queue, setQueue] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [starredOnly, setStarredOnly] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadDictationProgress().then(async (local) => {
      setProgress(local);
      const merged = await fullDictationSync(local);
      setProgress(merged);
      setReady(true);
    });
  }, [router, setProgress]);

  // Rebuild queue when ready or starredOnly filter changes.
  useEffect(() => {
    if (!ready) return;
    setQueue(buildDictationQueue(progressRef.current, { starredOnly }));
    setIndex(0);
    setResults([]);
  }, [ready, starredOnly, progressRef]);

  const current = queue[index];

  // Pre-compute gaps for the whole queue so they stay stable across renders
  const gaps = useMemo<Gap[]>(() => queue.map(generateGap), [queue]);

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (!current) return;
      recordAttempt(current.id, correct);
      setResults((r) => [...r, correct]);
    },
    [current, recordAttempt],
  );

  const handleNext = useCallback(() => setIndex((i) => i + 1), []);

  const practiceAgain = useCallback(() => {
    setQueue(buildDictationQueue(progressRef.current, { starredOnly }));
    setIndex(0);
    setResults([]);
  }, [progressRef, starredOnly]);

  if (!ready) {
    return <LoadingScreen />;
  }

  const finished = index >= queue.length;
  const empty = queue.length === 0;
  const stats = sessionStats(results);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6 md:max-w-xl md:gap-8 md:px-10 md:py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Diktat
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStarredOnly((v) => !v)}
            aria-pressed={starredOnly}
            aria-label={starredOnly ? 'Show all words' : 'Show starred only'}
            className={`btn btn-circle btn-text btn-sm md:hidden ${
              starredOnly
                ? '!text-amber-400'
                : '!text-base-content/60 hover:!text-base-content/80'
            }`}
          >
            {starredOnly ? (
              <StarIconSolid className="h-5 w-5" aria-hidden="true" />
            ) : (
              <StarIconOutline className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <AppNav />
        </div>
      </header>

      <div className="hidden flex-col gap-1.5 text-sm md:flex">
        <span className="text-base-content/60 text-[11px] font-medium tracking-wider uppercase">
          Filter
        </span>
        <div className="flex gap-1.5">
          {[
            { label: 'All', value: false },
            { label: 'Starred', value: true },
          ].map(({ label, value }) => (
            <Chip
              key={label}
              active={starredOnly === value}
              onClick={() => setStarredOnly(value)}
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <section className="mt-2 flex flex-1 flex-col">
        {empty && starredOnly ? (
          <div className="border-base-300 bg-base-200 flex flex-col items-center gap-3 rounded-2xl border py-16 text-center">
            <p className="text-lg font-medium">No starred words yet</p>
            <p className="text-base-content/60 text-sm">
              Tap ★ on a result card to bookmark a word for later.
            </p>
          </div>
        ) : finished ? (
          <SessionSummary
            heading={`${stats.correct}/${stats.total}`}
            subheading={`${stats.pct}% correct`}
            actionLabel="Practice again"
            onAction={practiceAgain}
          />
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-3">
            <p className="text-base-content/60 text-right text-xs">
              {index + 1} / {queue.length}
            </p>
            <DictationCard
              key={current.id}
              word={current}
              gap={gaps[index]}
              onAnswer={handleAnswer}
              onNext={handleNext}
              starred={progress[current.id]?.starred ?? false}
              onToggleStar={() => toggleStar(current.id)}
            />
          </div>
        )}
      </section>
    </main>
  );
}
