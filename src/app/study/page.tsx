'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import Modal from '@/components/shared/Modal';
import SessionSummary from '@/components/shared/SessionSummary';
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
import LoadingScreen from '@/components/shared/LoadingScreen';

export default function StudyPage() {
  const router = useRouter();
  const { progress, progressRef, setProgress, grade } = useProgressSync();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>({
    box: 'due',
    pos: 'all',
    level: 'all',
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

  // Stable identity so it doesn't rebuild useAiChat's memoized `ask` on
  // every WordPopover render.
  const handleUnauthorized = useCallback(
    () => router.replace('/login'),
    [router],
  );

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
    return <LoadingScreen />;
  }

  const finished = index >= queue.length;
  const empty = queue.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-5 py-4 md:max-w-xl md:gap-8 md:px-10 md:py-10">
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
          <SessionSummary
            heading="All caught up 🎉"
            subheading={`Reviewed ${queue.length} card${queue.length === 1 ? '' : 's'}.`}
            actionLabel="Study again"
            onAction={studyAgain}
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

      <Modal
        open={!!dailyText}
        onClose={() => setDailyText(null)}
        title="Tägliche Lektüre"
      >
        {dailyText && (
          <DailyReading
            text={dailyText}
            strugglingIds={strugglingIds(progress)}
            highlightAll
            onGrade={(wordId) => grade(wordId, onGood)}
            onUnauthorized={handleUnauthorized}
          />
        )}
      </Modal>
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
    <div className="border-base-300 bg-base-200 flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-base-content/60 text-sm">{subtitle}</p>
      {action}
    </div>
  );
}
