'use client';

import { useState } from 'react';
import type { Word, WordProgress, Box } from '@/types';
import { BOXES } from '@/constants';
import type { Grade } from '@/types/grade';
import {
  ARTICLE_COLOR,
  PLURAL_COLOR,
  resultBoxes,
  lemmaFontSize,
} from './index.helpers';
import { GRADE } from '@/constants';
import { useSpeech } from '@/hooks/useSpeech';
import SpeakButton from '@/components/SpeakButton';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

export default function FlashCard({
  word,
  progress,
  remainingByBox,
  onGrade,
  onSkip,
  onShuffle,
}: {
  word: Word;
  progress: WordProgress;
  remainingByBox: Record<Box, number>;
  onGrade: (grade: Grade) => void;
  onSkip: () => void;
  onShuffle?: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const { available, speaking, speak, stop } = useSpeech();

  const resultBox = resultBoxes(progress);

  const examples = word.examples.slice(0, 2);

  return (
    <div className="flex flex-col gap-5">
      <div
        className="relative h-72 w-full cursor-pointer [perspective:1200px] md:h-96"
        onClick={() => {
          stop();
          setFlipped((f) => !f);
        }}
        role="button"
        aria-label={flipped ? 'Show German' : 'Show translation'}
      >
        <div
          className={`preserve-3d relative h-full w-full transition-transform duration-500 ${
            flipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front: German */}
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center backface-hidden">
            <span className="absolute top-3 left-4 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
              Box {progress.box}
            </span>
            <div className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-2">
              {BOXES.map((b) =>
                remainingByBox[b] > 0 ? (
                  <span
                    key={b}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-500"
                  >
                    B{b}: {remainingByBox[b]}
                  </span>
                ) : null,
              )}
            </div>
            <span className="absolute top-3 right-4 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400 capitalize">
              {word.pos}
            </span>
            <h2
              className={`${lemmaFontSize(word.article, word.lemma)} w-full font-semibold tracking-tight break-words`}
            >
              {word.article && (
                <span className={`${ARTICLE_COLOR[word.article]} font-normal`}>
                  {word.article}{' '}
                </span>
              )}
              {word.lemma}
            </h2>
            {word.plural && (
              <p className="mt-2 text-sm text-slate-300">
                pl. <span className={PLURAL_COLOR}>die</span> {word.plural}
              </p>
            )}
            {available && (
              <SpeakButton
                text={word.lemma}
                speaking={speaking}
                onSpeak={() => speak(word.lemma)}
                className="mt-3"
              />
            )}
            {onShuffle && (
              <div className="absolute right-0 bottom-3 left-0 flex justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShuffle();
                  }}
                  aria-label="Random card from same box"
                  className="rounded-full bg-white/5 p-3 text-slate-400 transition-colors hover:text-slate-200 md:p-1.5"
                >
                  <ArrowsRightLeftIcon
                    className="h-5 w-5 md:h-4 md:w-4"
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}
          </div>

          {/* Back: English + examples */}
          <div className="absolute inset-0 flex rotate-y-180 flex-col items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] p-6 text-center backface-hidden">
            <h2 className="text-3xl font-semibold tracking-tight">{word.en}</h2>
            {examples.length > 0 && (
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                {examples.map((ex, i) => (
                  <li key={i} className="italic">
                    “{ex}”
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Before flip: Skip button. After flip: grade buttons. */}
      <div className="min-h-[60px]">
        {flipped ? (
          <div className="grid grid-cols-3 gap-3">
            <GradeButton
              label="Miss"
              box={resultBox.miss}
              className="bg-orange-500/15 text-orange-300 hover:bg-orange-500/25"
              onClick={() => onGrade(GRADE.MISS)}
            />
            <GradeButton
              label="Got it"
              box={resultBox.good}
              className="bg-teal-500/15 text-teal-300 hover:bg-teal-500/25"
              onClick={() => onGrade(GRADE.GOOD)}
            />
            <GradeButton
              label="Easy"
              box={resultBox.easy}
              className="bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
              onClick={() => onGrade(GRADE.EASY)}
            />
          </div>
        ) : (
          <button
            onClick={onSkip}
            className="w-full rounded-xl bg-white/5 px-3 py-3 font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-300"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

function GradeButton({
  label,
  box,
  className,
  onClick,
}: {
  label: string;
  box: Box;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-3 font-medium transition-colors ${className}`}
    >
      <span>{label}</span>
      <span className="text-[11px] opacity-70">→ Box {box}</span>
    </button>
  );
}
