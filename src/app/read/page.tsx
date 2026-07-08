'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import AppNav from '@/components/AppNav';
import type { DailyText } from '@/types';
import { dailyTexts, dailyTextById } from '@/lib/daily-texts';
import { localLoad, fullSync, getToken } from '@/lib/sync';
import { useProgressSync } from '@/hooks/useProgressSync';
import { onGood } from '@/lib/leitner';
import {
  strugglingIds,
  pickDailyText,
  todayKey,
  getTodaysPick,
  setTodaysPick,
} from '@/lib/daily';
import DailyReading from '@/components/DailyReading';
import { groupByTopic } from './page.helpers';

export default function ReadPage() {
  const router = useRouter();
  const { progress, setProgress, grade } = useProgressSync();
  const [ready, setReady] = useState(false);
  const [todayText, setTodayText] = useState<DailyText | null>(null);
  const [modalText, setModalText] = useState<DailyText | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  // Box-1 words drive both the highlight set and the daily pick; derive it from
  // the synced progress so it stays current as cards are graded here.
  const struggling = useMemo(() => strugglingIds(progress), [progress]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      const today = todayKey();
      const local = await localLoad();
      if (!cancelled) setProgress(local);
      const merged = await fullSync(local);
      if (cancelled) return;
      if (!getToken()) {
        router.replace('/login');
        return;
      }
      const ids = strugglingIds(merged);
      const cached = getTodaysPick();
      let pick: DailyText | null =
        cached && cached.date === today
          ? (dailyTextById(cached.textId) ?? null)
          : null;
      if (!pick) {
        pick = pickDailyText(dailyTexts, ids, today);
        if (pick) setTodaysPick({ date: today, textId: pick.id });
      }
      setProgress(merged);
      setTodayText(pick);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setProgress]);

  const handleGrade = (wordId: string) => grade(wordId, onGood);

  const groups = useMemo(() => groupByTopic(dailyTexts), []);

  const toggleTopic = (topic: string) =>
    setOpenTopic((cur) => (cur === topic ? null : topic));

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center text-slate-400">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6 md:grid md:max-w-5xl md:grid-cols-[1fr_300px] md:grid-rows-[auto_1fr] md:gap-8 md:px-10 md:py-10">
      <header className="flex items-baseline justify-between md:col-span-2">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Lesen
        </h1>
        <AppNav />
      </header>

      {/* Left column: today's text, or the text selected from the list on desktop */}
      {(todayText || modalText) && (
        <section className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.06] p-5 md:overflow-y-auto">
          <p className="mb-3 text-xs font-medium tracking-wide text-indigo-300 uppercase">
            Heutiger Text
          </p>
          <DailyReading
            text={modalText ?? todayText!}
            strugglingIds={struggling}
            highlightAll
            onGrade={handleGrade}
          />
        </section>
      )}

      {/* Right column on desktop / below on mobile */}
      <section className="flex flex-col gap-2 md:overflow-y-auto">
        {groups.map((g) => {
          const isOpen = openTopic === g.topic;
          return (
            <div
              key={g.topic}
              className="overflow-hidden rounded-xl border border-white/10"
            >
              <button
                onClick={() => toggleTopic(g.topic)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  {g.topic}
                </span>
                {isOpen ? (
                  <ChevronUpIcon
                    className="h-3.5 w-3.5 text-slate-500"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronDownIcon
                    className="h-3.5 w-3.5 text-slate-500"
                    aria-hidden="true"
                  />
                )}
              </button>
              {isOpen && (
                <ul className="flex flex-col divide-y divide-white/5 border-t border-white/10">
                  {g.texts.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setModalText(t)}
                        className="w-full px-4 py-2.5 text-left text-sm text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
                      >
                        {t.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      {/* Modal — mobile only; on desktop the left panel updates instead */}
      {modalText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 md:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalText(null)}
          style={{
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalText(null)}
              aria-label="Close"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <DailyReading
              text={modalText}
              strugglingIds={struggling}
              highlightAll
              onGrade={handleGrade}
            />
          </div>
        </div>
      )}
    </main>
  );
}
