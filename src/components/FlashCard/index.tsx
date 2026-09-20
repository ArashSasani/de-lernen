'use client';

import { useState } from 'react';
import type { Word, WordProgress, Box } from '@/types';
import { BOXES, ARTICLE_COLOR, PLURAL_COLOR, GRADE } from '@/constants';
import type { Grade } from '@/types/grade';
import { resultBoxes, lemmaFontSize } from './index.helpers';
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
          <div className="border-base-300 bg-base-200 absolute inset-0 flex flex-col items-center justify-center rounded-2xl border p-6 text-center backface-hidden">
            <span className="badge badge-soft badge-sm !text-base-content/60 absolute top-3 left-4">
              Box {progress.box}
            </span>
            <div className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-2">
              {BOXES.map((b) =>
                remainingByBox[b] > 0 ? (
                  <span
                    key={b}
                    className="badge badge-soft badge-xs !text-base-content/50"
                  >
                    B{b}: {remainingByBox[b]}
                  </span>
                ) : null,
              )}
            </div>
            <span className="badge badge-soft badge-sm !text-base-content/60 absolute top-3 right-4 capitalize">
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
              <p className="text-base-content/80 mt-2 text-sm">
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
                  className="btn btn-circle btn-soft btn-sm !text-base-content/70"
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
          <div className="border-primary/20 bg-primary/5 absolute inset-0 flex rotate-y-180 flex-col items-center justify-center rounded-2xl border p-6 text-center backface-hidden">
            <h2 className="text-3xl font-semibold tracking-tight">{word.en}</h2>
            {examples.length > 0 && (
              <ul className="text-base-content/80 mt-5 space-y-2 text-sm">
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
      <div className="h-[52px]">
        {flipped ? (
          <div className="grid h-full grid-cols-3 gap-3">
            <GradeButton
              label="Miss"
              box={resultBox.miss}
              className="light:text-orange-700 bg-orange-500/15 text-orange-300 hover:bg-orange-500/25"
              onClick={() => onGrade(GRADE.MISS)}
            />
            <GradeButton
              label="Got it"
              box={resultBox.good}
              className="light:text-teal-700 bg-teal-500/15 text-teal-300 hover:bg-teal-500/25"
              onClick={() => onGrade(GRADE.GOOD)}
            />
            <GradeButton
              label="Easy"
              box={resultBox.easy}
              className="light:text-violet-700 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
              onClick={() => onGrade(GRADE.EASY)}
            />
          </div>
        ) : (
          <button
            onClick={onSkip}
            className="btn btn-soft btn-block !text-base-content/80 h-full"
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
      className={`btn !h-auto !flex-col !gap-0.5 border-none !py-2 leading-tight ${className}`}
    >
      <span>{label}</span>
      <span className="text-[11px] leading-tight opacity-70">→ Box {box}</span>
    </button>
  );
}
