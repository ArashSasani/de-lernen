import { groupByTopic, filterByLevel } from './page.helpers';
import type { DailyText, Level } from '@/types';

const t = (
  id: string,
  topic: string,
  title: string,
  level: Level = 'a1',
): DailyText => ({
  id,
  title,
  topic,
  level,
  text: '...',
  wordIds: [],
  spans: [],
});

describe('groupByTopic', () => {
  it('groups texts by topic, sorted by topic then title', () => {
    const groups = groupByTopic([
      t('a', 'Wetter', 'Regen'),
      t('b', 'Essen', 'Suppe'),
      t('c', 'Wetter', 'Andere'),
    ]);
    expect(groups.map((g) => g.topic)).toEqual(['Essen', 'Wetter']);
    expect(groups[1].texts.map((x) => x.title)).toEqual(['Andere', 'Regen']);
  });

  it('returns an empty array for no texts', () => {
    expect(groupByTopic([])).toEqual([]);
  });
});

describe('filterByLevel', () => {
  const texts = [
    t('a', 'Wetter', 'Regen', 'a1'),
    t('b', 'Essen', 'Suppe', 'a2'),
    t('c', 'Wetter', 'Andere', 'a2'),
  ];

  it('passes everything through for "all"', () => {
    expect(filterByLevel(texts, 'all')).toEqual(texts);
  });

  it('keeps only texts matching the given level', () => {
    expect(filterByLevel(texts, 'a2').map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterByLevel(texts, 'b1')).toEqual([]);
  });
});
