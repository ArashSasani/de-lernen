'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from '@heroicons/react/24/outline';
import { ARTICLE_COLOR } from '@/constants';
import { wordById, wordLevel } from '@/lib/words';
import { useAiChat } from '@/hooks/useAiChat';
import SpeakButton from '@/components/SpeakButton';
import {
  glossForWord,
  choosePlacement,
  horizontalOffset,
  chipsForPos,
  CHIP_LABELS,
  parseReplyLines,
} from './index.helpers';

// Half of the panel's own w-[min(90vw,20rem)] width, used to keep it clear of
// the viewport edges; an estimate is fine since horizontalOffset only clamps.
const POPOVER_HALF_WIDTH = 160;

interface Layout {
  left: number;
  edge: number; // CSS `top` (placeBelow) or `bottom` (!placeBelow) value, px
  placeBelow: boolean;
  maxHeight: number;
  xOffset: number;
}

export default function WordPopover({
  surface,
  wordId,
  isStruggling,
  open,
  onToggle,
  onGrade,
  speakAvailable,
  speaking,
  onSpeak,
  onUnauthorized,
  online,
  aiEnabled,
}: {
  surface: string;
  wordId: string;
  isStruggling: boolean;
  open: boolean;
  onToggle: () => void;
  onGrade?: () => void;
  speakAvailable: boolean;
  speaking: boolean;
  onSpeak: (text: string) => void;
  onUnauthorized?: () => void;
  // Hoisted from the parent (DailyReading) — every highlighted span would
  // otherwise mount its own `online` listener pair and re-read
  // localStorage on render, though only one popover is ever open.
  online: boolean;
  aiEnabled: boolean;
}) {
  const style = isStruggling
    ? 'bg-indigo-500/20 text-indigo-200 decoration-indigo-400/40 hover:bg-indigo-500/30'
    : 'bg-slate-500/20 text-slate-300 decoration-slate-400/40 hover:bg-slate-500/30';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [question, setQuestion] = useState('');

  const word = wordById(wordId);
  const gloss = word && glossForWord(word);
  const aiChat = useAiChat(onUnauthorized);

  // Close = a clean slate: drop any reply/question so reopening the same
  // word doesn't show a stale answer, and cancel an in-flight stream so it
  // doesn't keep running (and billing) after the panel is gone. `aiChat` is a
  // fresh object every render, but `reset` itself is a stable useCallback —
  // depending on the object would re-run this on every render while closed.
  useEffect(() => {
    if (!open) {
      (async () => {
        aiChat.reset();
        setQuestion('');
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aiChat.reset]);

  // Positioned as a fixed-position portal (not absolute-in-flow), so the panel
  // is always a layer above the reading box rather than clipped by its scroll
  // container, and can grow as tall as the viewport actually allows. Recomputed
  // on every scroll/resize while open (not just once) so it stays pinned to the
  // word instead of drifting as the reading box (or the page) scrolls under it.
  useLayoutEffect(() => {
    if (!open) return;
    const updateLayout = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportHeight = window.innerHeight;
      const { placeBelow, maxHeight } = choosePlacement(
        rect.top,
        rect.bottom,
        viewportHeight,
      );
      const xOffset = horizontalOffset(
        rect.left + rect.width / 2,
        window.innerWidth,
        POPOVER_HALF_WIDTH,
      );
      setLayout({
        left: rect.left + rect.width / 2,
        edge: placeBelow ? rect.bottom + 8 : viewportHeight - rect.top + 8,
        placeBelow,
        maxHeight,
        xOffset,
      });
    };
    updateLayout();
    // `capture: true` also catches scrolling inside nested scroll containers
    // (e.g. the reading card's own overflow-y-auto), since `scroll` doesn't bubble.
    window.addEventListener('scroll', updateLayout, true);
    window.addEventListener('resize', updateLayout);
    return () => {
      window.removeEventListener('scroll', updateLayout, true);
      window.removeEventListener('resize', updateLayout);
    };
  }, [open]);

  const submitQuestion = () => {
    if (!word || !question.trim()) return;
    aiChat.ask(
      'ask',
      {
        lemma: word.lemma,
        article: word.article,
        plural: word.plural,
        en: word.en,
      },
      wordLevel(word),
      question.trim(),
    );
  };

  return (
    <span className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className={`rounded px-1 py-0.5 font-medium underline decoration-dotted underline-offset-2 ${style}`}
      >
        {surface}
      </button>
      {open &&
        gloss &&
        word &&
        layout &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: layout.left,
              [layout.placeBelow ? 'top' : 'bottom']: layout.edge,
              maxHeight: layout.maxHeight,
              transform: `translateX(calc(-50% + ${layout.xOffset}px))`,
            }}
            className="z-[70] flex w-[min(90vw,20rem)] flex-col overflow-y-auto rounded-xl border border-white/10 bg-slate-800 p-3 text-sm shadow-2xl"
          >
            <div className="flex items-center justify-center gap-2 font-medium">
              <span>
                {gloss.article && (
                  <span
                    className={`${ARTICLE_COLOR[gloss.article]} font-normal`}
                  >
                    {gloss.article}{' '}
                  </span>
                )}
                {gloss.lemma}
                {gloss.plural && (
                  <span className="ml-1 font-normal text-slate-400">
                    ({gloss.plural})
                  </span>
                )}
              </span>
              {speakAvailable && (
                <SpeakButton
                  text={gloss.lemma}
                  speaking={speaking}
                  onSpeak={() => onSpeak(gloss.lemma)}
                />
              )}
              {onGrade && (
                <button
                  type="button"
                  onClick={onGrade}
                  className="flex items-center justify-center rounded-full border border-indigo-500/50 p-1 text-sm leading-none text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/20 active:bg-indigo-500/30"
                  aria-label="Mark as known"
                >
                  <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="my-2 border-t border-white/10" />
            <p className="text-center text-slate-300">{gloss.en}</p>

            {aiEnabled && (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div
                  className={`flex flex-wrap justify-center gap-1 ${
                    online ? '' : 'pointer-events-none opacity-40'
                  }`}
                >
                  {chipsForPos(word.pos).map((intent) => (
                    <button
                      key={intent}
                      type="button"
                      onClick={() =>
                        aiChat.ask(
                          intent,
                          {
                            lemma: word.lemma,
                            article: word.article,
                            plural: word.plural,
                            en: word.en,
                          },
                          wordLevel(word),
                        )
                      }
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs text-slate-300 transition-colors hover:bg-white/[0.08]"
                    >
                      {CHIP_LABELS[intent]}
                    </button>
                  ))}
                </div>

                {!online && (
                  <p className="mt-1.5 text-center text-[11px] text-slate-500">
                    Offline
                  </p>
                )}

                <div
                  className={`mt-2 flex gap-1 ${
                    online ? '' : 'pointer-events-none opacity-40'
                  }`}
                >
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitQuestion();
                    }}
                    placeholder="Ask about this word…"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={submitQuestion}
                    className="shrink-0 rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-400"
                  >
                    Ask
                  </button>
                </div>

                {(aiChat.loading || aiChat.reply || aiChat.error) && (
                  <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/60 p-2.5 text-left text-xs leading-relaxed text-slate-300">
                    {aiChat.error ? (
                      <p className="text-rose-400">{aiChat.error}</p>
                    ) : aiChat.reply ? (
                      parseReplyLines(aiChat.reply).map((line, i) => (
                        <p
                          key={i}
                          className={
                            line.type === 'li'
                              ? 'mb-1 flex gap-1.5 pl-1 last:mb-0'
                              : line.type === 'h'
                                ? 'mb-1.5 text-[13px] font-semibold text-slate-100 last:mb-0'
                                : 'mb-1.5 last:mb-0'
                          }
                        >
                          {line.type === 'li' && (
                            <span aria-hidden="true" className="text-slate-500">
                              •
                            </span>
                          )}
                          <span>
                            {line.segments.map((seg, j) =>
                              seg.bold ? (
                                <strong key={j} className="text-slate-200">
                                  {seg.text}
                                </strong>
                              ) : (
                                <span key={j}>{seg.text}</span>
                              ),
                            )}
                          </span>
                        </p>
                      ))
                    ) : (
                      <span className="text-slate-500">…</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}
