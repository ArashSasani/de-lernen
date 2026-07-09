'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckIcon,
  XMarkIcon,
  StarIcon as StarIconSolid,
} from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import type { Word } from '@/types';
import type { Gap } from '@/lib/dictation';
import { useSpeech } from '@/hooks/useSpeech';
import SpeakButton from '@/components/SpeakButton';
import { ARTICLE_COLOR, checkAnswer, gapInputWidth } from './index.helpers';

type Phase = 'question' | 'result';

export default function DictationCard({
  word,
  gap,
  onAnswer,
  onNext,
  starred = false,
  onToggleStar,
}: {
  word: Word;
  gap: Gap;
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
  starred?: boolean;
  onToggleStar?: () => void;
}) {
  const { available, speaking, speak } = useSpeech();
  const [phase, setPhase] = useState<Phase>('question');
  const [input, setInput] = useState('');
  const [wasCorrect, setWasCorrect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const speakText = word.article ? `${word.article} ${word.lemma}` : word.lemma;

  // Auto-play on mount
  useEffect(() => {
    const t = setTimeout(() => speak(word.lemma), 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.lemma]);

  // Auto-play on result reveal only when wrong — correct answer needs no reinforcement
  useEffect(() => {
    if (phase === 'result' && !wasCorrect) {
      const t = setTimeout(() => speak(speakText), 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, wasCorrect]);

  useEffect(() => {
    if (phase === 'question') inputRef.current?.focus();
    else cardRef.current?.focus();
  }, [phase]);

  function submit() {
    if (phase !== 'question') return;
    const correct = checkAnswer(input, gap.gap);
    setWasCorrect(correct);
    setPhase('result');
    onAnswer(correct);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (phase === 'question') submit();
      else onNext();
    }
  }

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className="flex flex-col gap-5 outline-none"
      onKeyDown={handleKeyDown}
    >
      <div className="relative flex min-h-72 w-full flex-col items-center justify-center gap-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:min-h-96">
        {/* POS badge */}
        <span className="absolute top-3 right-4 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400 capitalize">
          {word.pos}
        </span>

        {/* Star bookmark — result phase only */}
        {phase === 'result' && onToggleStar && (
          <button
            onClick={onToggleStar}
            aria-pressed={starred}
            aria-label={starred ? 'Unstar this word' : 'Star this word'}
            className={`absolute top-3 left-4 rounded p-0.5 transition-colors ${
              starred ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
            }`}
          >
            {starred ? (
              <StarIconSolid className="h-5 w-5" aria-hidden="true" />
            ) : (
              <StarIconOutline className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        )}

        {phase === 'question' ? (
          <>
            {/* Gapped word */}
            <div className="flex items-baseline gap-0 text-3xl font-semibold tracking-tight">
              <span>{gap.before}</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ width: gapInputWidth(gap.gap.length) }}
                className="rounded border-b-2 border-dashed border-indigo-400 bg-transparent text-center text-indigo-200 outline-none focus:border-indigo-300"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                aria-label="Type the missing letters"
              />
              <span>{gap.after}</span>
            </div>

            {/* Audio */}
            {available && (
              <SpeakButton
                text={speakText}
                speaking={speaking}
                onSpeak={() => speak(speakText)}
              />
            )}
          </>
        ) : (
          <>
            {/* Result: correct or wrong */}
            {wasCorrect ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-start gap-2">
                  <CheckIcon
                    aria-hidden="true"
                    className="mt-1.5 h-6 w-6 flex-shrink-0 text-slate-200"
                  />
                  <p className="text-3xl font-semibold tracking-tight">
                    {word.article && (
                      <span
                        className={`${ARTICLE_COLOR[word.article]} font-normal`}
                      >
                        {word.article}{' '}
                      </span>
                    )}
                    {gap.before}
                    <span className="underline decoration-slate-200 decoration-2 underline-offset-4">
                      {gap.gap}
                    </span>
                    {gap.after}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                {/* User's wrong input */}
                <div className="flex items-start gap-2">
                  <XMarkIcon
                    aria-hidden="true"
                    className="mt-1 h-6 w-6 flex-shrink-0 text-slate-400"
                  />
                  <p className="text-2xl font-semibold tracking-tight text-slate-400 line-through">
                    {gap.before}
                    <span className="underline decoration-slate-400 decoration-2 underline-offset-4">
                      {input || '—'}
                    </span>
                    {gap.after}
                  </p>
                </div>
                {/* Correct form with article */}
                <p className="text-3xl font-semibold tracking-tight">
                  {word.article && (
                    <span
                      className={`${ARTICLE_COLOR[word.article]} font-normal`}
                    >
                      {word.article}{' '}
                    </span>
                  )}
                  {gap.before}
                  <span className="underline decoration-slate-200 decoration-2 underline-offset-4">
                    {gap.gap}
                  </span>
                  {gap.after}
                </p>
              </div>
            )}

            <p className="text-sm text-slate-400">{word.en}</p>

            {available && (
              <SpeakButton
                text={speakText}
                speaking={speaking}
                onSpeak={() => speak(speakText)}
              />
            )}
          </>
        )}
      </div>

      {/* Action button */}
      {phase === 'question' ? (
        <button
          onClick={submit}
          disabled={input.trim().length === 0}
          className="w-full rounded-xl bg-indigo-500/20 px-3 py-3 font-medium text-indigo-300 transition-colors hover:bg-indigo-500/30 disabled:bg-white/5 disabled:text-slate-500"
        >
          Check
        </button>
      ) : (
        <button
          onClick={onNext}
          className="w-full rounded-xl bg-indigo-500 px-3 py-3 font-medium text-white transition-colors hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Next →
        </button>
      )}
    </div>
  );
}
