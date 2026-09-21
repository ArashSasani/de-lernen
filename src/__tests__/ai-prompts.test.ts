import {
  ceilingLevel,
  buildPrompt,
  buildStructuredPrompt,
} from '@/lib/ai/prompts';
import { WORD_INTENTS } from '@/constants';
import type {
  GrammarIntentRequest,
  JudgeIntentRequest,
  NoteIntentRequest,
  QuizMissContext,
  WordIntentRequest,
} from '@/types/ai';
import { grammarTopicById } from '@/lib/grammar';

const baseWord: WordIntentRequest['word'] = {
  lemma: 'Haus',
  article: 'das',
  plural: 'Häuser',
  en: 'house',
};

function req(overrides: Partial<WordIntentRequest> = {}): WordIntentRequest {
  return {
    intent: 'erklaeren',
    level: 'a1',
    word: baseWord,
    ...overrides,
  };
}

describe('ceilingLevel', () => {
  it('defaults a missing learnerLevel to a1', () => {
    expect(ceilingLevel('a1')).toBe('a1');
    expect(ceilingLevel('a2')).toBe('a2');
  });

  it('defaults an invalid learnerLevel to a1', () => {
    expect(ceilingLevel('a1', 'xx' as never)).toBe('a1');
  });

  it('takes the higher of level and learnerLevel', () => {
    expect(ceilingLevel('a1', 'b1')).toBe('b1');
    expect(ceilingLevel('b1', 'a1')).toBe('b1');
    expect(ceilingLevel('a2', 'a2')).toBe('a2');
  });
});

describe('buildPrompt', () => {
  it.each(WORD_INTENTS)('returns a non-empty prompt spec for %s', (intent) => {
    const spec = buildPrompt(
      req({ intent, question: intent === 'ask' ? 'Warum?' : undefined }),
    );
    expect(spec.system.length).toBeGreaterThan(0);
    expect(spec.user.length).toBeGreaterThan(0);
    expect(spec.maxTokens).toBeGreaterThan(0);
  });

  it('embeds the question only for ask', () => {
    const ask = buildPrompt(req({ intent: 'ask', question: 'Warum Genitiv?' }));
    expect(ask.user).toContain('Warum Genitiv?');

    const erklaeren = buildPrompt(req({ intent: 'erklaeren' }));
    expect(erklaeren.user).not.toContain('Warum Genitiv?');
  });

  it('raises the register preamble to the learner ceiling', () => {
    const spec = buildPrompt(req({ level: 'a1', learnerLevel: 'b1' }));
    expect(spec.system).toContain('B1');
    expect(spec.system).not.toContain('A1');
  });

  // The preamble aims at the ceiling instead of only capping at it — a pure
  // upper bound left A1-grade output valid at every level, so raising the
  // learnerLevel pref produced no visible change.
  it('targets the ceiling rather than only bounding it', () => {
    const spec = buildPrompt(req({ level: 'a1', learnerLevel: 'a2' }));
    expect(spec.system).toContain('typical of A2');
    expect(spec.system).toContain('neither markedly below');
  });

  it('still allows an explicitly requested construction above the ceiling', () => {
    const spec = buildPrompt(req({ intent: 'genitiv', level: 'a1' }));
    expect(spec.system).toContain('above A1');
  });
});

const baseQuiz: QuizMissContext = {
  topicId: 'dativ-prepositions',
  prompt: 'Ich fahre ___ dem Bus.',
  choices: ['den', 'dem', 'der'],
  correctIndex: 1,
  learnerAnswerIndex: 0,
  explanation: 'mit takes Dativ.',
};

describe('buildStructuredPrompt — note/judge', () => {
  const noteReq: NoteIntentRequest = {
    intent: 'note',
    level: 'a1',
    quiz: baseQuiz,
  };

  const judgeReq: JudgeIntentRequest = {
    intent: 'judge',
    level: 'a1',
    quiz: baseQuiz,
    candidate: { text: 'confused Akkusativ and Dativ after mit' },
  };

  it('returns a non-empty spec + schema for note', () => {
    const spec = buildStructuredPrompt(noteReq);
    expect(spec.system.length).toBeGreaterThan(0);
    expect(spec.user).toContain('Ich fahre ___ dem Bus.');
    expect(spec.maxTokens).toBeGreaterThan(0);
    expect(spec.schema.type).toBe('object');
    expect(spec.schema.required).toEqual(
      expect.arrayContaining(['found', 'text', 'confidence']),
    );
    expect(spec.schema.additionalProperties).toBe(false);
  });

  it('returns a non-empty spec + schema for judge', () => {
    const spec = buildStructuredPrompt(judgeReq);
    expect(spec.system.length).toBeGreaterThan(0);
    expect(spec.user).toContain('confused Akkusativ and Dativ after mit');
    expect(spec.maxTokens).toBeGreaterThan(0);
    expect(spec.schema.required).toEqual(
      expect.arrayContaining(['keep', 'reason']),
    );
    expect(spec.schema.additionalProperties).toBe(false);
  });

  it('respects the register ceiling for structured intents too', () => {
    const spec = buildStructuredPrompt({ ...noteReq, learnerLevel: 'b1' });
    expect(spec.system).toContain('B1');
  });
});

describe('buildStructuredPrompt — grammar', () => {
  const topic = grammarTopicById('sein-praesens')!;

  function grammarReq(
    overrides: Partial<GrammarIntentRequest> = {},
  ): GrammarIntentRequest {
    return {
      intent: 'grammar',
      level: 'a1',
      topicId: 'sein-praesens',
      batchSize: 3,
      difficulty: 'medium',
      ...overrides,
    };
  }

  it('returns a non-empty spec + schema, fenced with the topic material', () => {
    const spec = buildStructuredPrompt(grammarReq(), topic);
    expect(spec.system.length).toBeGreaterThan(0);
    expect(spec.user).toContain(topic.title);
    expect(spec.maxTokens).toBeGreaterThan(0);
    expect(spec.schema.required).toEqual(['items']);
  });

  it('omits the performance/already-asked/notes blocks when empty', () => {
    const spec = buildStructuredPrompt(grammarReq(), topic);
    expect(spec.user).not.toContain('session');
    expect(spec.user).not.toContain('Already asked');
    expect(spec.user).not.toContain('Known recurring confusions');
  });

  it('composes a natural-language performance sentence, not raw JSON', () => {
    const spec = buildStructuredPrompt(
      grammarReq({ recentResults: [true, true, false] }),
      topic,
    );
    expect(spec.user).toContain('2 of their last 3');
    expect(spec.user).not.toContain('[true,true,false]');
  });

  it('fences already-asked prompts and notes when present', () => {
    const spec = buildStructuredPrompt(
      grammarReq({
        alreadyAsked: ['Wie heißt du?'],
        notes: ['confuses ist/sind'],
      }),
      topic,
    );
    expect(spec.user).toContain('Already asked');
    expect(spec.user).toContain('Wie heißt du?');
    expect(spec.user).toContain('Known recurring confusions');
    expect(spec.user).toContain('confuses ist/sind');
  });

  it('throws if called without a resolved topic', () => {
    expect(() => buildStructuredPrompt(grammarReq())).toThrow();
  });
});
