import { groupByTopic } from './page.helpers';
import type { DailyText } from '@/types';

const t = (id: string, topic: string, title: string): DailyText => ({
  id,
  title,
  topic,
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
