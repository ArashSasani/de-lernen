import { POS_CHIPS, BOX_CHIPS, LEVEL_CHIPS, ARTICLE_COLOR } from '@/constants';

describe('ARTICLE_COLOR', () => {
  it('maps each article to a colour class', () => {
    expect(ARTICLE_COLOR.der).toContain('text-');
    expect(ARTICLE_COLOR.die).toContain('text-');
    expect(ARTICLE_COLOR.das).toContain('text-');
  });
});

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
