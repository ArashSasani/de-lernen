'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import type { DailyText } from '@/types';
import { ARTICLE_COLOR } from '@/constants';
import {
  toSegments,
  glossFor,
  resolveHighlight,
  shouldFlipBelow,
  horizontalOffset,
  type Gloss,
} from './index.helpers';
import { useSpeech } from '@/hooks/useSpeech';
import SpeakButton from '@/components/SpeakButton';

export default function DailyReading({
  text,
  strugglingIds,
  highlightAll = false,
  onGrade,
}: {
  text: DailyText;
  // Study page: omit highlightAll (default false) — only words in this set
  // are highlighted; others render as plain text.
  // Read page: pass highlightAll — every annotated word is highlighted, but
  // words in this set get the indigo (struggling) style; others get slate.
  strugglingIds?: ReadonlySet<string>;
  highlightAll?: boolean;
  onGrade?: (wordId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { available, speaking, speak } = useSpeech();

  const segments = toSegments(text.text, text.spans);

  return (
    <div className="flex flex-col gap-4">
      {openId && (
        <button
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-[9]"
          onClick={() => setOpenId(null)}
        />
      )}
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-indigo-300 uppercase">
          {text.topic}
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{text.title}</h2>
      </header>

      <p className="text-justify text-[16px] leading-relaxed whitespace-pre-line text-slate-200 md:text-[18px] md:leading-[1.8]">
        {segments.map((seg, i) => {
          if (!seg.wordId) return <span key={i}>{seg.text}</span>;

          const { isStruggling, shouldHighlight } = resolveHighlight(
            seg.wordId,
            strugglingIds,
            highlightAll,
          );

          return shouldHighlight ? (
            <Highlight
              key={i}
              surface={seg.text}
              gloss={glossFor(seg.wordId)}
              isStruggling={isStruggling}
              open={openId === `${seg.wordId}-${i}`}
              onToggle={() =>
                setOpenId((cur) =>
                  cur === `${seg.wordId}-${i}` ? null : `${seg.wordId}-${i}`,
                )
              }
              onGrade={
                onGrade && isStruggling
                  ? () => {
                      onGrade(seg.wordId!);
                      setOpenId(null);
                    }
                  : undefined
              }
              speakAvailable={available}
              speaking={speaking}
              onSpeak={speak}
            />
          ) : (
            <span key={i}>{seg.text}</span>
          );
        })}
      </p>
    </div>
  );
}

function Highlight({
  surface,
  gloss,
  isStruggling,
  open,
  onToggle,
  onGrade,
  speakAvailable,
  speaking,
  onSpeak,
}: {
  surface: string;
  gloss: Gloss | undefined;
  isStruggling: boolean;
  open: boolean;
  onToggle: () => void;
  onGrade?: () => void;
  speakAvailable: boolean;
  speaking: boolean;
  onSpeak: (text: string) => void;
}) {
  const style = isStruggling
    ? 'bg-indigo-500/20 text-indigo-200 decoration-indigo-400/40 hover:bg-indigo-500/30'
    : 'bg-slate-500/20 text-slate-300 decoration-slate-400/40 hover:bg-slate-500/30';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [placeBelow, setPlaceBelow] = useState(false);
  const [xOffset, setXOffset] = useState(0);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPlaceBelow(shouldFlipBelow(rect.top));
    setXOffset(horizontalOffset(rect.left + rect.width / 2, window.innerWidth));
  }, [open]);

  return (
    <span className="relative z-[11] inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className={`rounded px-1 py-0.5 font-medium underline decoration-dotted underline-offset-2 ${style}`}
      >
        {surface}
      </button>
      {open && gloss && (
        <span
          style={{ transform: `translateX(calc(-50% + ${xOffset}px))` }}
          className={`absolute left-1/2 z-[10] w-max max-w-[16rem] rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-center text-sm shadow-lg ${
            placeBelow ? 'top-full mt-1' : 'bottom-full mb-1'
          }`}
        >
          <span className="flex items-center justify-center gap-2 font-medium">
            <span>
              {gloss.article && (
                <span className={`${ARTICLE_COLOR[gloss.article]} font-normal`}>
                  {gloss.article}{' '}
                </span>
              )}
              {gloss.lemma}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onGrade();
                }}
                className="flex items-center justify-center rounded-full border border-indigo-500/50 p-1 text-sm leading-none text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/20 active:bg-indigo-500/30"
                aria-label="Mark as known"
              >
                <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </span>
          <span className="my-2 block border-t border-white/10" />
          <span className="block text-slate-300">{gloss.en}</span>
        </span>
      )}
    </span>
  );
}
