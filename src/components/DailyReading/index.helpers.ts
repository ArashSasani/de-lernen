import type { DailyTextSpan } from '@/types';
import { allWords } from '@/lib/words';

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

export interface Gloss {
  lemma: string;
  article: string | null;
  en: string;
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

// The gloss popover renders above its word by default. Near the top of the
// page or a scroll container there isn't enough room, so it gets clipped —
// flip it to render below instead when the word's viewport-relative top is
// closer than the popover's (estimated) height to the top edge.
export function shouldFlipBelow(
  wordTop: number,
  estimatedPopoverHeight = 90,
): boolean {
  return wordTop < estimatedPopoverHeight;
}

// The popover is horizontally centered on its word by default. Near the left
// or right edge of the viewport that centering pushes it partly off-screen —
// return the extra x-shift (px, added on top of the -50% centering) needed to
// keep both edges within `margin` of the viewport, or 0 if centering is fine.
export function horizontalOffset(
  wordCenterX: number,
  viewportWidth: number,
  popoverHalfWidth = 128,
  margin = 8,
): number {
  const leftEdge = wordCenterX - popoverHalfWidth;
  const overflowLeft = margin - leftEdge;
  if (overflowLeft > 0) return overflowLeft;

  const rightEdge = wordCenterX + popoverHalfWidth;
  const overflowRight = rightEdge - (viewportWidth - margin);
  if (overflowRight > 0) return -overflowRight;

  return 0;
}

const WORD_BY_ID = new Map(allWords.map((w) => [w.id, w]));

// The translation/article shown when a highlighted word is tapped.
export function glossFor(wordId: string): Gloss | undefined {
  const w = WORD_BY_ID.get(wordId);
  if (!w) return undefined;
  return { lemma: w.lemma, article: w.article, en: w.en };
}
