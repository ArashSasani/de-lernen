'use client';

import { Suspense, useEffect, useState, startTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  PuzzlePieceIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import AppNav from '@/components/AppNav';
import GrammarTableView from '@/components/GrammarTableView';
import GrammarExampleView from '@/components/GrammarExampleView';
import { getToken } from '@/lib/sync';
import { topicsByCategory, grammarTopicById } from '@/lib/grammar';
import { isQuizzableTopic } from '@/lib/grammar-quiz';
import {
  activeGroups,
  splitParagraphs,
  filterGroups,
  filterGroupsByLevel,
  LEVEL_CHIPS,
} from './page.helpers';
import type { GrammarTopic } from '@/types';
import type { LevelFilter } from '@/types/filter';
import type { CategoryGroup } from '@/lib/grammar';

const groups: CategoryGroup[] = topicsByCategory();

function TopicContent({ topic }: { topic: GrammarTopic }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-slate-100">
              {topic.title}
            </p>
            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
              {topic.level}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{topic.summary}</p>
        </div>
        {isQuizzableTopic(topic.id) && (
          <Link
            href={`/grammar/quiz?topic=${topic.id}`}
            className="mr-8 shrink-0 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-400 md:hidden"
          >
            Quiz
          </Link>
        )}
      </div>

      {topic.explanation && (
        <div className="flex flex-col gap-2">
          {splitParagraphs(topic.explanation).map((p, i) => (
            <p key={i} className="text-sm text-slate-300">
              {p}
            </p>
          ))}
        </div>
      )}

      {topic.tables.length > 0 && (
        <div className="flex flex-col gap-3">
          {topic.tables.map((table, i) => (
            <GrammarTableView key={i} table={table} />
          ))}
        </div>
      )}

      {topic.examples.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Beispiele
          </p>
          {topic.examples.map((ex, i) => (
            <GrammarExampleView key={i} example={ex} />
          ))}
        </div>
      )}

      {topic.tips.length > 0 && (
        <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/[0.06] px-3 py-3">
          <p className="mb-1.5 text-xs font-medium tracking-wide text-indigo-400 uppercase">
            Tipps
          </p>
          <ul className="flex flex-col gap-1">
            {topic.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-300">
                <span className="mt-px text-indigo-400" aria-hidden="true">
                  •
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function GrammarPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center text-slate-400">
          Loading…
        </main>
      }
    >
      <GrammarPageInner />
    </Suspense>
  );
}

function GrammarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialOpenCategory = searchParams.get('open');
  const initialTopicId = searchParams.get('topic');

  const [ready, setReady] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(
    initialOpenCategory,
  );
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(() =>
    initialTopicId ? (grammarTopicById(initialTopicId) ?? null) : null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    startTransition(() => setReady(true));
  }, [router]);

  const visible = activeGroups(groups);
  const byLevel = filterGroupsByLevel(visible, levelFilter);
  const visibleGroups = filterGroups(byLevel, searchQuery);
  const isSearching = searchQuery.trim().length > 0;

  const toggleCategory = (category: string) =>
    setOpenCategory((cur) => (cur === category ? null : category));

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
          Grammatik
        </h1>
        <AppNav />
      </header>

      {/* Left column: selected topic content */}
      {selectedTopic ? (
        <section className="hidden rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.06] p-5 md:block md:overflow-y-auto">
          <TopicContent topic={selectedTopic} />
        </section>
      ) : (
        <section className="hidden items-center justify-center rounded-2xl border border-white/5 md:flex md:overflow-y-auto">
          <p className="text-sm text-slate-500">Select a topic from the list</p>
        </section>
      )}

      {/* Right column: search + category accordions */}
      <section className="flex flex-col gap-2 md:overflow-y-auto">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Grammatik suchen…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pr-9 pl-9 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-400/50 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {LEVEL_CHIPS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLevelFilter(value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                levelFilter === value
                  ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300'
                  : 'border-white/10 text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Link
          href="/grammar/quiz"
          className="flex items-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-500/[0.06] px-4 py-3 text-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-500/[0.12]"
        >
          <PuzzlePieceIcon className="h-4 w-4" aria-hidden="true" />
          Smart Quiz
        </Link>

        {visibleGroups.map((g) => {
          const isOpen = isSearching || openCategory === g.category;
          return (
            <div
              key={g.category}
              className="overflow-hidden rounded-xl border border-white/10"
            >
              <button
                onClick={() => toggleCategory(g.category)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  {g.label}
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
                  {g.topics.map((topic) => {
                    const isActive = selectedTopic?.id === topic.id;
                    return (
                      <li
                        key={topic.id}
                        className={`flex items-center gap-1 ${isActive ? 'bg-indigo-500/10' : ''}`}
                      >
                        <button
                          onClick={() => setSelectedTopic(topic)}
                          className="flex-1 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <p
                            className={`text-sm hover:text-slate-100 ${isActive ? 'text-indigo-300' : 'text-slate-300'}`}
                          >
                            {topic.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {topic.summary}
                          </p>
                        </button>
                        {isQuizzableTopic(topic.id) && (
                          <Link
                            href={`/grammar/quiz?topic=${topic.id}`}
                            className="mr-2 shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
                          >
                            Quiz
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        {isSearching && visibleGroups.length === 0 && (
          <p className="px-4 py-3 text-sm text-slate-500">Keine Ergebnisse</p>
        )}
      </section>

      {/* Modal — mobile only */}
      {selectedTopic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 md:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedTopic(null)}
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
              onClick={() => setSelectedTopic(null)}
              aria-label="Close"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <TopicContent topic={selectedTopic} />
          </div>
        </div>
      )}
    </main>
  );
}
