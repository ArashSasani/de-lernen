import { WORD_INTENTS } from '@/constants';
import { WORD_INTENT_MODEL, modelForIntent } from '@/lib/ai/models';

describe('modelForIntent', () => {
  it('maps every word intent to a model', () => {
    for (const intent of WORD_INTENTS) {
      expect(typeof modelForIntent(intent)).toBe('string');
      expect(modelForIntent(intent).length).toBeGreaterThan(0);
    }
  });

  it('currently routes every intent to the same model', () => {
    const models = new Set(WORD_INTENTS.map((i) => modelForIntent(i)));
    expect(models.size).toBe(1);
    expect(models.has(WORD_INTENT_MODEL)).toBe(true);
  });
});
