'use client';

import { useEffect, useState } from 'react';
import type { QuizQuestion } from '@/types/grammar-quiz';
import { grammarTopicById } from '@/lib/grammar';
import { choiceStyle } from './index.helpers';

interface Props {
  question: QuizQuestion;
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
}

export default function GrammarQuizCard({ question, onAnswer, onNext }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === question.correctIndex;

  const topic = grammarTopicById(question.topicId);

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    onAnswer(index === question.correctIndex);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (answered) {
        if (e.key === 'Enter') onNext();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= question.choices.length) {
        handleSelect(n - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // handleSelect is stable within this effect's closure; answered/choices drive re-subscription
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, question.choices.length, question.correctIndex, onNext]);

  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-4 rounded-2xl border p-5">
      {topic && <p className="text-base-content/60 text-xs">{topic.title}</p>}

      <p className="text-lg font-medium whitespace-pre-line">
        {question.prompt}
      </p>

      <div className="flex flex-col gap-2">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            disabled={answered}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${choiceStyle(answered, i, selected, question.correctIndex)}`}
          >
            <span className="mr-2 text-xs opacity-40">{i + 1}</span>
            {choice}
          </button>
        ))}
      </div>

      {!answered && (
        <div className="flex justify-end">
          <button
            onClick={onNext}
            className="btn btn-soft btn-sm !text-base-content/80"
          >
            Skip
          </button>
        </div>
      )}

      {answered && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p
              className={`text-sm font-medium ${isCorrect ? 'light:text-emerald-700 text-emerald-400' : 'light:text-rose-700 text-rose-400'}`}
            >
              {isCorrect
                ? 'Richtig!'
                : `Richtige Antwort: ${question.choices[question.correctIndex]}`}
            </p>
            <button onClick={onNext} className="btn btn-primary btn-sm">
              Next
            </button>
          </div>
          <p className="text-base-content/60 text-sm">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
