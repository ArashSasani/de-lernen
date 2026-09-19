import type { DailyTextSpan } from '@/types';

export interface Segment {
  text: string;
  wordId?: string; // present → highlighted, tappable for a gloss
}

// Turn a text + its (sorted, non-overlapping) spans into a flat list of
// segments for rendering. Plain stretches between spans keep their line breaks
// so the component can render them with `whitespace-pre-line`.
export function toSegments(text: string, spans: DailyTextSpan[]): Segment[] {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let cursor = 0;
  for (const s of ordered) {
    if (s.start < cursor) continue; // defensive: skip any overlap
    if (s.start > cursor) out.push({ text: text.slice(cursor, s.start) });
    out.push({ text: text.slice(s.start, s.end), wordId: s.wordId });
    cursor = s.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });
  return out;
}

export interface HighlightVariant {
  shouldHighlight: boolean;
  isStruggling: boolean;
}

// Decide whether a segment should be highlighted and which visual tier to use:
//   no strugglingIds          → highlight everything, all indigo
//   strugglingIds, !highlightAll → only struggling words highlighted; others plain
//   strugglingIds, highlightAll  → all highlighted; struggling=indigo, others=slate
export function resolveHighlight(
  wordId: string,
  strugglingIds?: ReadonlySet<string>,
  highlightAll = false,
): HighlightVariant {
  const isStruggling = strugglingIds === undefined || strugglingIds.has(wordId);
  return { isStruggling, shouldHighlight: highlightAll || isStruggling };
}
