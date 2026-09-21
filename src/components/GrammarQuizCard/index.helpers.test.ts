import { choiceStyle, isAcceptable, alternativeChoice } from './index.helpers';
import type { QuizQuestion } from '@/types/grammar-quiz';

function question(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: 'q1',
    topicId: 't1',
    level: 'a1',
    difficulty: 'easy',
    prompt: 'Ich ___ nach Hause.',
    choices: ['gehe', 'fahre', 'gehst', 'geht'],
    correctIndex: 0,
    explanation: '...',
    ...overrides,
  };
}

describe('isAcceptable', () => {
  it('defaults to [correctIndex] when the field is absent', () => {
    const q = question();
    expect(isAcceptable(q, 0)).toBe(true);
    expect(isAcceptable(q, 1)).toBe(false);
  });

  it('accepts every index in acceptableIndices', () => {
    const q = question({ acceptableIndices: [0, 1] });
    expect(isAcceptable(q, 0)).toBe(true);
    expect(isAcceptable(q, 1)).toBe(true);
    expect(isAcceptable(q, 2)).toBe(false);
  });
});

describe('alternativeChoice', () => {
  it('returns null when the field is absent', () => {
    expect(alternativeChoice(question(), 1)).toBeNull();
  });

  it('returns null when the learner picked correctIndex', () => {
    expect(
      alternativeChoice(question({ acceptableIndices: [0, 1] }), 0),
    ).toBeNull();
  });

  it('names correctIndex when the learner picked a different acceptable choice', () => {
    expect(alternativeChoice(question({ acceptableIndices: [0, 1] }), 1)).toBe(
      'gehe',
    );
  });

  it('returns null when the learner picked a wrong choice', () => {
    expect(
      alternativeChoice(question({ acceptableIndices: [0, 1] }), 2),
    ).toBeNull();
  });
});

describe('choiceStyle', () => {
  it('returns neutral style when not yet answered', () => {
    const style = choiceStyle(false, 0, null, 2);
    expect(style).toContain('base-content/80');
    expect(style).toContain('hover:bg-base-300');
  });

  it('highlights the correct choice in green after answering', () => {
    expect(choiceStyle(true, 2, 1, 2)).toContain('emerald');
  });

  it('highlights the wrong selection in red', () => {
    expect(choiceStyle(true, 1, 1, 2)).toContain('rose');
  });

  it('dims unselected wrong choices', () => {
    expect(choiceStyle(true, 0, 1, 2)).toContain('base-content/60');
  });

  it('when selected === correct, only the correct (green) style applies', () => {
    const style = choiceStyle(true, 2, 2, 2);
    expect(style).toContain('emerald');
    expect(style).not.toContain('rose');
  });
});
