import type { MistakeCorpus } from '@/types/mistakes';
import { hasControlChars, isDirectiveLike } from './mistakes-gate';

const PER_TOPIC_CAP = 2;
const TOTAL_CAP = 5;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // very old notes stop being useful scaffolding

// Notes to inject into a grammar-generation prompt for the current batch's
// topics: newest-first, capped per-topic (2) and in total (5) so one noisy
// topic can't crowd out the batch. Re-asserts the gate's hygiene checks at
// injection time — a record can arrive via fullMistakesSync from a device
// running an older gate, so the write-time check alone isn't sufficient.
export function notesForPrompt(
  corpus: MistakeCorpus,
  topicIds: readonly string[],
  opts?: { now?: number; maxAgeMs?: number },
): string[] {
  const now = opts?.now ?? Date.now();
  const maxAge = opts?.maxAgeMs ?? MAX_AGE_MS;
  const topicSet = new Set(topicIds);

  const relevant = corpus
    .filter(
      (r) =>
        r.source === 'grammar-quiz' &&
        r.topicId !== undefined &&
        topicSet.has(r.topicId) &&
        now - r.createdAt <= maxAge,
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  const perTopicCount = new Map<string, number>();
  const out: string[] = [];
  for (const r of relevant) {
    if (out.length >= TOTAL_CAP) break;
    const topicId = r.topicId as string;
    const count = perTopicCount.get(topicId) ?? 0;
    if (count >= PER_TOPIC_CAP) continue;
    if (hasControlChars(r.text) || isDirectiveLike(r.text)) continue;
    out.push(r.text);
    perTopicCount.set(topicId, count + 1);
  }
  return out;
}
