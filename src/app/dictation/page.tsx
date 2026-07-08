'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import AppNav from '@/components/AppNav';
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
    return (
      <main className="flex flex-1 items-center justify-center text-slate-400">
        Loading…
      </main>
    );
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
            className={`rounded-lg p-1.5 transition-colors md:hidden ${
              starredOnly
                ? 'text-amber-400'
                : 'text-slate-500 hover:text-slate-300'
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
        <span className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">
          Filter
        </span>
        <div className="flex gap-1.5">
          {[
            { label: 'All', value: false },
            { label: 'Starred', value: true },
          ].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setStarredOnly(value)}
              className={`rounded-full px-3 py-1 transition-colors ${
                starredOnly === value
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-2 flex-1">
        {empty && starredOnly ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
            <p className="text-lg font-medium">No starred words yet</p>
            <p className="text-sm text-slate-400">
              Tap ★ on a result card to bookmark a word for later.
            </p>
          </div>
        ) : finished ? (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <div>
              <p className="text-4xl font-semibold">
                {stats.correct}/{stats.total}
              </p>
              <p className="mt-1 text-slate-400">{stats.pct}% correct</p>
            </div>
            <button
              onClick={practiceAgain}
              className="rounded-xl bg-indigo-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-indigo-400"
            >
              Practice again
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-right text-xs text-slate-500">
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
