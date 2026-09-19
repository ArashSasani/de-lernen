import { LEARNER_LEVEL_OPTIONS } from './page.helpers';

describe('LEARNER_LEVEL_OPTIONS', () => {
  it('offers exactly a1, a2 in order', () => {
    expect(LEARNER_LEVEL_OPTIONS.map((o) => o.value)).toEqual(['a1', 'a2']);
  });
});
