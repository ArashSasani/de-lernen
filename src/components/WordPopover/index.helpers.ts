import { POS } from '@/constants';
import type { Pos, Word } from '@/types';
import type { WordIntent } from '@/types/ai';

export interface Gloss {
  lemma: string;
  article: string | null;
  plural: string | null;
  en: string;
}

// The offline gloss shown when a highlighted word is tapped — "cheap facts
// stay data-backed": article/plural/meaning always come from words.json, never
// from the model. Takes the already-looked-up Word (not a wordId) so callers
// with the word in hand don't pay for a second lookup.
export function glossForWord(word: Word): Gloss {
  return {
    lemma: word.lemma,
    article: word.article,
    plural: word.plural,
    en: word.en,
  };
}

export interface PopoverLayout {
  placeBelow: boolean;
  maxHeight: number;
}

const MIN_POPOVER_HEIGHT = 160;
const MAX_POPOVER_HEIGHT = 420;

// The popover is portaled above the page (position: fixed), so it never gets
// clipped by the reading box's own scroll container — but it still needs to
// pick whichever side of the word has more room, and cap its own height to
// what's actually available there so it never runs off-screen. Content beyond
// that cap scrolls internally (the panel sets overflow-y-auto). MIN_POPOVER_HEIGHT
// is a *preference*, not a floor forced past what's available: on a short
// viewport (e.g. a landscape phone) `available` can be smaller than it, and
// claiming more height than that would push the panel off the far edge with
// no way to scroll it into view — so `available` always wins when it's the
// smaller of the two.
export function choosePlacement(
  wordTop: number,
  wordBottom: number,
  viewportHeight: number,
  margin = 12,
): PopoverLayout {
  const spaceAbove = wordTop - margin;
  const spaceBelow = viewportHeight - wordBottom - margin;
  const placeBelow = spaceBelow >= spaceAbove;
  const available = Math.max(placeBelow ? spaceBelow : spaceAbove, 0);
  const maxHeight = Math.min(
    MAX_POPOVER_HEIGHT,
    Math.max(Math.min(MIN_POPOVER_HEIGHT, available), available),
  );
  return { placeBelow, maxHeight };
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

// Which of the fixed AI chips make sense for a word's part of speech.
// Genitiv only applies to nouns, Konjugation/Partizip II/Imperativ only to
// verbs, Komparativ only to true adjectives — most adverbs in this A1/A2 list
// are temporal ("morgen", "gestern") or locational ("oben", "draußen") and
// have no comparative form at all, so ADV is deliberately excluded here
// (unlike the noun/verb/adj checks). Beispiel/Erklären are always meaningful.
// Free-ask is not a chip and is always available regardless of POS.
export function chipsForPos(pos: Pos): WordIntent[] {
  const chips: WordIntent[] = [];
  if (pos === POS.NOUN) chips.push('genitiv');
  if (pos === POS.VERB) chips.push('konjugation', 'partizip2', 'imperativ');
  if (pos === POS.ADJ) chips.push('komparativ');
  chips.push('beispiel', 'erklaeren');
  return chips;
}

export const CHIP_LABELS: Record<WordIntent, string> = {
  genitiv: 'Genitiv',
  konjugation: 'Konjugation',
  partizip2: 'Partizip II',
  imperativ: 'Imperativ',
  komparativ: 'Komparativ',
  beispiel: 'Beispiel',
  erklaeren: 'Erklären',
  ask: 'Ask',
};

export interface ReplySegment {
  text: string;
  bold?: boolean;
}

export interface ReplyLine {
  type: 'p' | 'li' | 'h';
  segments: ReplySegment[];
}

const BOLD_RE = /\*\*(.+?)\*\*/g;

function parseSegments(text: string): ReplySegment[] {
  const segments: ReplySegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(BOLD_RE)) {
    if (match.index! > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments;
}

// A minimal markdown-lite reader for AI replies — `# heading` lines, bold
// `**text**`, and `- ` bullet lines — without pulling in a markdown dependency
// for one small box.
export function parseReplyLines(text: string): ReplyLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const isHeading = /^#{1,6}\s+/.test(line);
      const isBullet = !isHeading && /^[-*]\s+/.test(line);
      const content = isHeading
        ? line.replace(/^#{1,6}\s+/, '')
        : isBullet
          ? line.replace(/^[-*]\s+/, '')
          : line;
      return {
        type: isHeading ? 'h' : isBullet ? 'li' : 'p',
        segments: parseSegments(content),
      } as ReplyLine;
    });
}
