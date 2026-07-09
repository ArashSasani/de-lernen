import { POS_CHIPS, BOX_CHIPS, LEVEL_CHIPS } from './index.helpers';

describe('LEVEL_CHIPS', () => {
  it('starts with an "All" chip followed by every extracted level', () => {
    expect(LEVEL_CHIPS[0]).toEqual({ value: 'all', label: 'All' });
    // b1 has no extracted vocabulary yet, so it's hidden until it does.
    expect(LEVEL_CHIPS.slice(1).map((c) => c.value)).toEqual(['a1', 'a2']);
  });

  it('uppercases level labels', () => {
    expect(LEVEL_CHIPS.slice(1).map((c) => c.label)).toEqual(['A1', 'A2']);
  });
});

describe('POS_CHIPS / BOX_CHIPS', () => {
  it('are non-empty', () => {
    expect(POS_CHIPS.length).toBeGreaterThan(0);
    expect(BOX_CHIPS.length).toBeGreaterThan(0);
  });
});
