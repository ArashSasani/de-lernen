/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { QuizQuestion } from '@/types/grammar-quiz';
import GrammarQuizCard from './index';

// choiceStyle/isAcceptable/alternativeChoice are unit-tested next door; this
// covers the card's own behaviour — that a pick reports the right verdict and
// index, that it locks after one answer, and that the keyboard path (1-N,
// then Enter) does the same thing the buttons do.

afterEach(cleanup);

const question: QuizQuestion = {
  id: 'mit-dativ-01',
  topicId: 'praepositionen-dativ',
  level: 'a1',
  difficulty: 'medium',
  prompt: 'Ich fahre ___ dem Bus.',
  choices: ['mit', 'für', 'ohne'],
  correctIndex: 0,
  explanation: 'mit always takes the Dativ.',
};

function setup(overrides: Partial<QuizQuestion> = {}) {
  const onAnswer = jest.fn();
  const onNext = jest.fn();
  render(
    <GrammarQuizCard
      question={{ ...question, ...overrides }}
      onAnswer={onAnswer}
      onNext={onNext}
    />,
  );
  return { onAnswer, onNext };
}

describe('GrammarQuizCard', () => {
  it('renders the prompt and every choice', () => {
    setup();
    expect(screen.getByText('Ich fahre ___ dem Bus.')).toBeTruthy();
    for (const choice of question.choices) {
      expect(screen.getByText(choice)).toBeTruthy();
    }
  });

  it('reports a correct pick with its index', () => {
    const { onAnswer } = setup();
    fireEvent.click(screen.getByText('mit'));
    expect(onAnswer).toHaveBeenCalledWith(true, 0);
    expect(screen.getByText('Richtig!')).toBeTruthy();
  });

  it('reports a wrong pick and names the right answer', () => {
    const { onAnswer } = setup();
    fireEvent.click(screen.getByText('ohne'));
    expect(onAnswer).toHaveBeenCalledWith(false, 2);
    expect(screen.getByText('Richtige Antwort: mit')).toBeTruthy();
  });

  it('reveals the explanation only after answering', () => {
    setup();
    expect(screen.queryByText(question.explanation)).toBeNull();
    fireEvent.click(screen.getByText('mit'));
    expect(screen.getByText(question.explanation)).toBeTruthy();
  });

  it('ignores a second pick once answered', () => {
    const { onAnswer } = setup();
    fireEvent.click(screen.getByText('für'));
    fireEvent.click(screen.getByText('mit'));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('swaps Skip for Next after answering', () => {
    const { onNext } = setup();
    fireEvent.click(screen.getByText('Skip'));
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('mit'));
    expect(screen.queryByText('Skip')).toBeNull();
    fireEvent.click(screen.getByText('Next'));
    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it('answers from the number keys and advances on Enter', () => {
    const { onAnswer, onNext } = setup();
    fireEvent.keyDown(window, { key: '3' });
    expect(onAnswer).toHaveBeenCalledWith(false, 2);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('ignores a number key with no matching choice', () => {
    const { onAnswer } = setup();
    fireEvent.keyDown(window, { key: '9' });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('names the primary answer when the learner picked a secondary acceptable one', () => {
    const { onAnswer } = setup({ acceptableIndices: [0, 1] });
    fireEvent.click(screen.getByText('für'));
    expect(onAnswer).toHaveBeenCalledWith(true, 1);
    expect(
      screen.getByText('Richtig! — ›mit‹ wäre auch möglich.'),
    ).toBeTruthy();
  });

  it('names no alternative when the learner picked correctIndex itself', () => {
    setup({ acceptableIndices: [0, 1] });
    fireEvent.click(screen.getByText('mit'));
    expect(screen.getByText('Richtig!')).toBeTruthy();
  });

  it('marks a generated question and leaves a bank question unmarked', () => {
    setup();
    expect(screen.queryByText('AI-generated question')).toBeNull();
    cleanup();

    setup({ id: 'ai-praepositionen-dativ-1a2b3c4d' });
    expect(screen.getByText('AI-generated question')).toBeTruthy();
  });
});
