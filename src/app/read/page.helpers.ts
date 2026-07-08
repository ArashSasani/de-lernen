import type { DailyText } from '@/types';

export interface TopicGroup {
  topic: string;
  texts: DailyText[];
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
