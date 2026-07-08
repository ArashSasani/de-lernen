'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';
import AppNav from '@/components/AppNav';
import type { DailyText, Word } from '@/types';
import { allWords } from '@/lib/words';
import { defaultProgress, isDue, boxCounts, onGood } from '@/lib/leitner';
import { dailyTexts } from '@/lib/daily-texts';
import {
  strugglingIds,
  pickDailyText,
  todayKey,
  getShownDate,
  markShownToday,
  setTodaysPick,
} from '@/lib/daily';
import DailyReading from '@/components/DailyReading';
import { localLoad, fullSync, getToken } from '@/lib/sync';
import { useProgressSync } from '@/hooks/useProgressSync';
import type { Grade } from '@/types/grade';
import type { Filter } from '@/types/filter';
import FlashCard from '@/components/FlashCard';
import FilterBar from '@/components/FilterBar';
import LeitnerStats from '@/components/LeitnerStats';
import {
  progressFor,
  buildQueue,
  gradeWord,
  queueBoxCounts,
} from './page.helpers';
import { makeShuffleDeck } from '@/lib/shuffle';

export default function StudyPage() {
  const router = useRouter();
  const { progress, progressRef, setProgress, grade } = useProgressSync();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>({
    box: 'due',
    pos: 'all',
  });
  const [queue, setQueue] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const shuffleDeckRef = useRef(makeShuffleDeck());
  // The daily reading shown in the once-per-day modal (null when dismissed).
  const [dailyText, setDailyText] = useState<DailyText | null>(null);

  // Auth guard + initial load + sync.
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    // Ask the browser to keep our IndexedDB rather than evict it under pressure.
    // Best-effort: unsupported / denied is fine, KV sync is the backstop.
    navigator.storage?.persist?.().catch(() => {});
    let cancelled = false;
    (async () => {
      const local = await localLoad();
      if (!cancelled) setProgress(local);
      const merged = await fullSync(local);
      if (cancelled) return;
      if (!getToken()) {
        router.replace('/login');
        return;
      }
      setProgress(merged);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setProgress]);

  // Rebuild the session queue when the filter changes (not on every grade).
  useEffect(() => {
    if (!ready) return;
    shuffleDeckRef.current.reset();
    setQueue(buildQueue(filter, progressRef.current));
    setIndex(0);
  }, [filter, ready, progressRef]);

  // Surface the daily reading once per day on open. The pick targets the user's
  // current box-1 (struggling) words; it's cached so the /read page agrees and
  // the choice stays stable for the day even as more cards are graded.
  useEffect(() => {
    if (!ready) return;
    const today = todayKey();
    if (getShownDate() === today) return;
    const pick = pickDailyText(
      dailyTexts,
      strugglingIds(progressRef.current),
      today,
    );
    if (pick) {
      setTodaysPick({ date: today, textId: pick.id });
      setDailyText(pick);
      markShownToday(today);
    }
  }, [ready, progressRef]);

  const current = queue[index];

  const handleSkip = useCallback(() => setIndex((i) => i + 1), []);

  const handleGrade = useCallback(
    (g: Grade) => {
      if (!current) return;
      grade(current.id, (prev) => gradeWord(prev, g));
      setIndex((i) => i + 1);
    },
    [current, grade],
  );

  const handleShuffle = useCallback(() => {
    if (!current) return;
    const currentBox = progressFor(progress, current.id).box;
    const sameBoxAhead = queue
      .slice(index + 1)
      .filter((w) => progressFor(progress, w.id).box === currentBox);
    if (sameBoxAhead.length === 0) return;
    const nextId = shuffleDeckRef.current.next(sameBoxAhead.map((w) => w.id));
    if (!nextId) return;
    const picked = sameBoxAhead.find((w) => w.id === nextId);
    if (!picked) return;
    setQueue((q) => {
      const next = [...q];
      const pickedIdx = next.findIndex((w, i) => i > index && w.id === nextId);
      if (pickedIdx === -1) return q;
      next[pickedIdx] = next[index];
      next[index] = picked;
      return next;
    });
  }, [current, queue, index, progress]);

  const canShuffle = useMemo(() => {
    if (!current) return false;
    const currentBox = progressFor(progress, current.id).box;
    return queue
      .slice(index + 1)
      .some((w) => progressFor(progress, w.id).box === currentBox);
  }, [current, queue, index, progress]);

  const studyAgain = useCallback(() => {
    setQueue(buildQueue(filter, progressRef.current));
    setIndex(0);
  }, [filter, progressRef]);

  const counts = useMemo(() => {
    const c = boxCounts(progress);
    const graded = new Set(Object.keys(progress));
    c[1] += allWords.filter((w) => !graded.has(w.id)).length;
    return c;
  }, [progress]);
  const due = useMemo(
    () =>
      allWords.filter((w) => isDue(progress[w.id] ?? defaultProgress())).length,
    [progress],
  );
  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center text-slate-400">
        Loading…
      </main>
    );
  }

  const finished = index >= queue.length;
  const empty = queue.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6 md:max-w-xl md:gap-8 md:px-10 md:py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          de·lernen
        </h1>
        <AppNav />
      </header>

      <LeitnerStats counts={counts} />

      <FilterBar filter={filter} dueCount={due} onChange={setFilter} />

      <section className="mt-2 flex-1">
        {empty ? (
          <EmptyState
            title="Nothing here"
            subtitle="No cards match this filter."
          />
        ) : finished ? (
          <EmptyState
            title="All caught up 🎉"
            subtitle={`Reviewed ${queue.length} card${queue.length === 1 ? '' : 's'}.`}
            action={
              <button
                onClick={studyAgain}
                className="rounded-xl bg-indigo-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-indigo-400"
              >
                Study again
              </button>
            }
          />
        ) : (
          <>
            <FlashCard
              key={current.id}
              word={current}
              progress={progressFor(progress, current.id)}
              remainingByBox={queueBoxCounts(queue, index, progress)}
              onGrade={handleGrade}
              onSkip={handleSkip}
              onShuffle={canShuffle ? handleShuffle : undefined}
            />
          </>
        )}
      </section>

      {dailyText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDailyText(null)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6 md:max-w-2xl md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDailyText(null)}
              aria-label="Close"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="mb-4 text-xs font-medium tracking-wide text-slate-500 uppercase">
              Tägliche Lektüre
            </p>
            <DailyReading
              text={dailyText}
              strugglingIds={strugglingIds(progress)}
              highlightAll
              onGrade={(wordId) => grade(wordId, onGood)}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-slate-400">{subtitle}</p>
      {action}
    </div>
  );
}
