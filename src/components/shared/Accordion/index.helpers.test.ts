import { toggleExclusive } from './index.helpers';

describe('toggleExclusive', () => {
  it('opens an item and collapses whatever else was open', () => {
    expect(toggleExclusive(['a'], 'b')).toEqual(['b']);
    expect(toggleExclusive(['a', 'b', 'c'], 'd')).toEqual(['d']);
  });

  it('opens the first item from an empty set', () => {
    expect(toggleExclusive([], 'a')).toEqual(['a']);
  });

  it('closes an open item without touching the others', () => {
    expect(toggleExclusive(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(toggleExclusive(['a'], 'a')).toEqual([]);
  });

  it('does not mutate the input', () => {
    const open = ['a', 'b'];
    toggleExclusive(open, 'a');
    toggleExclusive(open, 'c');
    expect(open).toEqual(['a', 'b']);
  });
});
