import {
  ceilingLevel,
  buildPrompt,
  buildStructuredPrompt,
} from '@/lib/ai/prompts';
import { WORD_INTENTS } from '@/constants';
import type {
  JudgeIntentRequest,
  NoteIntentRequest,
  WordIntentRequest,
} from '@/types/ai';

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

describe('buildStructuredPrompt', () => {
  const noteReq: NoteIntentRequest = {
    intent: 'note',
    level: 'a1',
    word: baseWord,
    exchange: {
      question: 'why does mit take Dativ',
      reply: 'mit is always followed by Dativ.',
    },
  };

  const judgeReq: JudgeIntentRequest = {
    intent: 'judge',
    level: 'a1',
    word: baseWord,
    exchange: noteReq.exchange,
    candidate: {
      text: 'asked why mit takes Dativ',
      evidence: 'why does mit take Dativ',
      claimedLemma: 'mit',
    },
  };

  it('returns a non-empty spec + schema for note', () => {
    const spec = buildStructuredPrompt(noteReq);
    expect(spec.system.length).toBeGreaterThan(0);
    expect(spec.user).toContain('why does mit take Dativ');
    expect(spec.maxTokens).toBeGreaterThan(0);
    expect(spec.schema.type).toBe('object');
    expect(spec.schema.required).toEqual(
      expect.arrayContaining([
        'found',
        'text',
        'evidence',
        'confidence',
        'claimedLemma',
      ]),
    );
    expect(spec.schema.additionalProperties).toBe(false);
  });

  it('returns a non-empty spec + schema for judge', () => {
    const spec = buildStructuredPrompt(judgeReq);
    expect(spec.system.length).toBeGreaterThan(0);
    expect(spec.user).toContain('asked why mit takes Dativ');
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
