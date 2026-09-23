'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  XMarkIcon,
  PuzzlePieceIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import AppNav from '@/components/AppNav';
import GrammarTableView from '@/components/GrammarTableView';
import GrammarExampleView from '@/components/GrammarExampleView';
import Accordion from '@/components/shared/Accordion';
import { toggleExclusive } from '@/components/shared/Accordion/index.helpers';
import Chip from '@/components/shared/Chip';
import Modal from '@/components/shared/Modal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { loadDataset } from '@/lib/dataset';
import { getToken } from '@/lib/sync';
import { DESKTOP_MEDIA_QUERY, LEVEL_CHIPS } from '@/constants';
import { topicsByCategory, grammarTopicById } from '@/lib/grammar';
import { isQuizzableTopic } from '@/lib/grammar-quiz';
import {
  activeGroups,
  splitParagraphs,
  filterGroups,
  filterGroupsByLevel,
} from './page.helpers';
import type { GrammarTopic } from '@/types';
import type { LevelFilter } from '@/types/filter';
import type { CategoryGroup } from '@/lib/grammar';
import LoadingScreen from '@/components/shared/LoadingScreen';

const groups: CategoryGroup[] = topicsByCategory();

function TopicContent({ topic }: { topic: GrammarTopic }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold">{topic.title}</p>
            <span className="badge badge-soft badge-xs !text-base-content/60 uppercase">
              {topic.level}
            </span>
          </div>
          <p className="text-base-content/60 mt-0.5 text-xs">{topic.summary}</p>
        </div>
        {isQuizzableTopic(topic.id) && (
          <Link
            href={`/grammar/quiz?topic=${topic.id}`}
            className="btn btn-primary btn-xs mr-8 shrink-0 md:hidden"
          >
            Quiz
          </Link>
        )}
      </div>

      {topic.explanation && (
        <div className="flex flex-col gap-2">
          {splitParagraphs(topic.explanation).map((p, i) => (
            <p key={i} className="text-base-content/80 text-sm">
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
        <div className="border-base-300 bg-base-200 flex flex-col gap-2 rounded-lg border px-3 py-3">
          <p className="text-base-content/60 text-xs font-medium tracking-wide uppercase">
            Beispiele
          </p>
          {topic.examples.map((ex, i) => (
            <GrammarExampleView key={i} example={ex} />
          ))}
        </div>
      )}

      {topic.tips.length > 0 && (
        <div className="border-primary/20 bg-primary/5 rounded-lg border px-3 py-3">
          <p className="text-primary mb-1.5 text-xs font-medium tracking-wide uppercase">
            Tipps
          </p>
          <ul className="flex flex-col gap-1">
            {topic.tips.map((tip, i) => (
              <li key={i} className="text-base-content/80 flex gap-2 text-xs">
                <span className="text-primary mt-px" aria-hidden="true">
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
    <Suspense fallback={<LoadingScreen />}>
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
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(() =>
    initialTopicId ? (grammarTopicById(initialTopicId) ?? null) : null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  // Deep-linked category (?open=) is just the initial value — after that the
  // open set is ordinary React state, so there's nothing to re-assert later.
  const [openCategories, setOpenCategories] = useState<string[]>(() =>
    initialOpenCategory ? [initialOpenCategory] : [],
  );
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    // Grammar prose is bundled, but `isQuizzableTopic` reads the fetched
    // bank — without waiting, every topic renders without its quiz link.
    let cancelled = false;
    void loadDataset().then(() => {
      if (!cancelled) startTransition(() => setReady(true));
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Clearing `?topic=` matters: /grammar/quiz links back here as
  // `/grammar?open=<cat>&topic=<id>`, so leaving the param in place would
  // reopen the topic modal every time the user returns to this page after
  // having closed it.
  const closeTopic = useCallback(() => {
    setSelectedTopic(null);
    if (!searchParams.has('topic')) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('topic');
    const query = params.toString();
    router.replace(query ? `/grammar?${query}` : '/grammar', { scroll: false });
  }, [router, searchParams]);

  const visible = useMemo(() => activeGroups(groups), []);
  const byLevel = useMemo(
    () => filterGroupsByLevel(visible, levelFilter),
    [visible, levelFilter],
  );
  const visibleGroups = useMemo(
    () => filterGroups(byLevel, searchQuery),
    [byLevel, searchQuery],
  );
  const isSearching = searchQuery.trim().length > 0;

  // Search results are easier to scan fully expanded, so while a query is
  // active every matching category is forced open — re-applied whenever the
  // matching *set* changes (not on every keystroke that merely re-filters
  // topics within the same categories), so a category revealed by a narrower
  // query opens too. Leaving search doesn't re-collapse anything; the user
  // closes what they don't need, same as any other manual toggle.
  //
  // Adjusting state during render is React's documented alternative to an
  // effect for "derive from a prop/state change" — it re-renders before the
  // browser paints, so the panels never flash shut and open again.
  const searchKey = isSearching
    ? visibleGroups.map((g) => g.category).join(',')
    : null;
  const [appliedSearchKey, setAppliedSearchKey] = useState<string | null>(null);
  if (searchKey !== appliedSearchKey) {
    setAppliedSearchKey(searchKey);
    if (searchKey !== null) {
      setOpenCategories(visibleGroups.map((g) => g.category));
    }
  }

  if (!ready) {
    return <LoadingScreen />;
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
        <section className="border-primary/20 bg-primary/5 hidden rounded-2xl border p-5 md:block md:overflow-y-auto">
          <TopicContent topic={selectedTopic} />
        </section>
      ) : (
        <section className="border-base-300 hidden items-center justify-center rounded-2xl border md:flex md:overflow-y-auto">
          <p className="text-base-content/60 text-sm">
            Select a topic from the list
          </p>
        </section>
      )}

      {/* Right column: search + category accordions */}
      <section className="flex flex-col gap-2 md:overflow-y-auto">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon
            className="text-base-content/60 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Grammatik suchen…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pr-9 pl-9 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="text-base-content/60 hover:text-base-content/80 absolute top-1/2 right-3 -translate-y-1/2"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {LEVEL_CHIPS.map(({ value, label }) => (
            <Chip
              key={value}
              active={levelFilter === value}
              onClick={() => setLevelFilter(value)}
            >
              {label}
            </Chip>
          ))}
        </div>

        <Link
          href="/grammar/quiz"
          className="text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
        >
          <PuzzlePieceIcon className="h-4 w-4" aria-hidden="true" />
          Smart Quiz
        </Link>

        <Accordion
          openIds={openCategories}
          onToggle={(id) =>
            setOpenCategories((prev) => toggleExclusive(prev, id))
          }
          toggleClassName="hover:bg-base-300/50"
          items={visibleGroups.map((g) => ({
            id: g.category,
            label: (
              <span className="text-base-content/60 text-xs font-medium tracking-wide uppercase">
                {g.label}
              </span>
            ),
            content: (
              <ul className="divide-base-300 border-base-300 flex flex-col divide-y border-t">
                {g.topics.map((topic) => {
                  const isActive = selectedTopic?.id === topic.id;
                  return (
                    <li
                      key={topic.id}
                      className={`flex items-center gap-1 ${isActive ? 'bg-primary/10' : ''}`}
                    >
                      <button
                        onClick={() => setSelectedTopic(topic)}
                        className="hover:bg-base-300/50 flex-1 px-4 py-2.5 text-left transition-colors"
                      >
                        <p
                          className={`hover:text-base-content text-sm ${isActive ? 'text-primary' : 'text-base-content/80'}`}
                        >
                          {topic.title}
                        </p>
                        <p className="text-base-content/60 mt-0.5 text-xs">
                          {topic.summary}
                        </p>
                      </button>
                      {isQuizzableTopic(topic.id) && (
                        <Link
                          href={`/grammar/quiz?topic=${topic.id}`}
                          className="btn btn-soft btn-primary btn-xs mr-2 shrink-0"
                        >
                          Quiz
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            ),
          }))}
        />

        {isSearching && visibleGroups.length === 0 && (
          <p className="text-base-content/60 px-4 py-3 text-sm">
            Keine Ergebnisse
          </p>
        )}
      </section>

      {/* Modal — mobile only; on desktop the left column shows the topic.
          Gated on a media query rather than `md:hidden` so it doesn't mount
          (and scroll-lock the body) behind an invisible wrapper on desktop. */}
      {!isDesktop && (
        <Modal
          open={!!selectedTopic}
          onClose={closeTopic}
          title={selectedTopic?.title ?? 'Thema'}
        >
          {selectedTopic && <TopicContent topic={selectedTopic} />}
        </Modal>
      )}
    </main>
  );
}
