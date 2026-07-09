import type { DailyText } from '@/types';
import type { LevelFilter } from '@/types/filter';
import { FILTER } from '@/constants';

export interface TopicGroup {
  topic: string;
  texts: DailyText[];
}

// Narrow the browsable corpus to one level, or pass everything through for "all".
export function filterByLevel(
  texts: DailyText[],
  level: LevelFilter,
): DailyText[] {
  return level === FILTER.ALL ? texts : texts.filter((t) => t.level === level);
}

// Group the corpus by topic for the browsable list, with topics and titles in
// stable alphabetical order so the page renders deterministically.
export function groupByTopic(texts: DailyText[]): TopicGroup[] {
  const map = new Map<string, DailyText[]>();
  for (const t of texts) {
    const list = map.get(t.topic);
    if (list) list.push(t);
    else map.set(t.topic, [t]);
  }
  return [...map.entries()]
    .map(([topic, ts]) => ({
      topic,
      texts: [...ts].sort((a, b) => (a.title < b.title ? -1 : 1)),
    }))
    .sort((a, b) => (a.topic < b.topic ? -1 : 1));
}
