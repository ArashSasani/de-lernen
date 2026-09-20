'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import Accordion from '@/components/shared/Accordion';
import { toggleExclusive } from '@/components/shared/Accordion/index.helpers';
import Chip from '@/components/shared/Chip';
import Modal from '@/components/shared/Modal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { DailyText } from '@/types';
import type { LevelFilter } from '@/types/filter';
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
import { DESKTOP_MEDIA_QUERY, FILTER, LEVEL_CHIPS } from '@/constants';
import { groupByTopic, filterByLevel } from './page.helpers';
import LoadingScreen from '@/components/shared/LoadingScreen';

export default function ReadPage() {
  const router = useRouter();
  const { progress, setProgress, grade } = useProgressSync();
  const [ready, setReady] = useState(false);
  const [todayText, setTodayText] = useState<DailyText | null>(null);
  const [modalText, setModalText] = useState<DailyText | null>(null);
  const [level, setLevel] = useState<LevelFilter>(FILTER.ALL);
  const [openTopics, setOpenTopics] = useState<string[]>([]);
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

  // Box-1 words drive both the highlight set and the daily pick; derive it from
  // the synced progress so it stays current as cards are graded here.
  const struggling = useMemo(() => strugglingIds(progress), [progress]);

  // Stable identity so it doesn't rebuild useAiChat's memoized `ask` on
  // every WordPopover render.
  const handleUnauthorized = useCallback(
    () => router.replace('/login'),
    [router],
  );

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

  const groups = useMemo(
    () => groupByTopic(filterByLevel(dailyTexts, level)),
    [level],
  );

  if (!ready) {
    return <LoadingScreen />;
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
        <section className="border-primary/20 bg-primary/5 rounded-2xl border p-5 md:overflow-y-auto">
          <p className="text-primary mb-3 text-xs font-medium tracking-wide uppercase">
            Heutiger Text
          </p>
          <DailyReading
            text={modalText ?? todayText!}
            strugglingIds={struggling}
            highlightAll
            onGrade={handleGrade}
            onUnauthorized={handleUnauthorized}
          />
        </section>
      )}

      {/* Right column on desktop / below on mobile */}
      <section className="flex flex-col gap-3 md:overflow-y-auto">
        <div className="flex flex-col gap-1">
          <span className="text-base-content/60 text-[10px] font-medium tracking-wider uppercase">
            Level
          </span>
          <div className="flex flex-wrap gap-1 text-xs">
            {LEVEL_CHIPS.map((l) => (
              <Chip
                key={l.value}
                active={level === l.value}
                onClick={() => setLevel(l.value)}
              >
                {l.label}
              </Chip>
            ))}
          </div>
        </div>
        {groups.length === 0 && (
          <p className="text-base-content/60 px-1 text-sm">
            No texts at this level yet.
          </p>
        )}
        <Accordion
          openIds={openTopics}
          onToggle={(id) => setOpenTopics((prev) => toggleExclusive(prev, id))}
          toggleClassName="!py-3"
          items={groups.map((g) => ({
            id: g.topic,
            label: (
              <span className="text-base-content/60 text-xs font-medium tracking-wide uppercase">
                {g.topic}
              </span>
            ),
            content: (
              <ul className="border-base-300 divide-base-300 flex flex-col divide-y border-t">
                {g.texts.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setModalText(t)}
                      className="hover:bg-base-300/40 hover:text-base-content w-full px-4 py-2.5 text-left text-sm"
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            ),
          }))}
        />
      </section>

      {/* Modal — mobile only; on desktop the left panel updates instead.
          Gated on a media query rather than `md:hidden` so it doesn't mount
          (and scroll-lock the body) behind an invisible wrapper on desktop. */}
      {!isDesktop && (
        <Modal
          open={!!modalText}
          onClose={() => setModalText(null)}
          title={modalText?.title ?? 'Heutiger Text'}
        >
          {modalText && (
            <DailyReading
              text={modalText}
              strugglingIds={struggling}
              highlightAll
              onGrade={handleGrade}
              onUnauthorized={handleUnauthorized}
            />
          )}
        </Modal>
      )}
    </main>
  );
}
