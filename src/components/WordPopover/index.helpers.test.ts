import {
  glossForWord,
  choosePlacement,
  horizontalOffset,
  chipsForPos,
  parseReplyLines,
} from './index.helpers';
import { wordById } from '@/lib/words';

describe('glossForWord', () => {
  it('returns lemma, article, plural and English for a real word', () => {
    const word = wordById('apfel');
    expect(word).toBeDefined();
    const g = glossForWord(word!);
    expect(g.lemma).toBe('Apfel');
    expect(g.article).toBe('der');
    expect(typeof g.en).toBe('string');
    expect('plural' in g).toBe(true);
  });
});

describe('choosePlacement', () => {
  it('places below and caps height to available space when near the top', () => {
    const { placeBelow, maxHeight } = choosePlacement(20, 40, 800);
    expect(placeBelow).toBe(true);
    expect(maxHeight).toBe(420); // capped at MAX, plenty of room below
  });

  it('places above when there is more room above than below', () => {
    const { placeBelow } = choosePlacement(780, 800, 800);
    expect(placeBelow).toBe(false);
  });

  it('picks whichever side has more room', () => {
    // spaceAbove = 400-12=388, spaceBelow = 800-420-12=368 -> more room above
    const { placeBelow, maxHeight } = choosePlacement(400, 420, 800);
    expect(placeBelow).toBe(false);
    expect(maxHeight).toBe(388);
  });

  it('never claims more height than is actually available, even below the preferred minimum', () => {
    // A short (landscape-phone) viewport with the word roughly centered:
    // spaceAbove = spaceBelow = 128, well under MIN_POPOVER_HEIGHT (160).
    // Forcing 160 here would push the panel past the opposite viewport edge.
    const { maxHeight } = choosePlacement(140, 160, 300);
    expect(maxHeight).toBe(128);
  });

  it('never returns a negative height when there is no room at all', () => {
    const { maxHeight } = choosePlacement(5, 10, 20);
    expect(maxHeight).toBeGreaterThanOrEqual(0);
  });
});

describe('horizontalOffset', () => {
  it('needs no shift when the popover fits centered in the viewport', () => {
    expect(horizontalOffset(200, 400, 128, 8)).toBe(0);
  });

  it('shifts right when centering would clip the left edge', () => {
    expect(horizontalOffset(20, 400, 128, 8)).toBe(116);
  });

  it('shifts left when centering would clip the right edge', () => {
    expect(horizontalOffset(390, 400, 128, 8)).toBe(-126);
  });
});

describe('chipsForPos', () => {
  it('offers Genitiv only for nouns', () => {
    expect(chipsForPos('noun')).toContain('genitiv');
    expect(chipsForPos('verb')).not.toContain('genitiv');
  });

  it('offers Konjugation only for verbs', () => {
    expect(chipsForPos('verb')).toContain('konjugation');
    expect(chipsForPos('noun')).not.toContain('konjugation');
  });

  it('offers Partizip II and Imperativ only for verbs', () => {
    expect(chipsForPos('verb')).toContain('partizip2');
    expect(chipsForPos('verb')).toContain('imperativ');
    expect(chipsForPos('noun')).not.toContain('partizip2');
    expect(chipsForPos('noun')).not.toContain('imperativ');
  });

  it('offers Komparativ only for adjectives, not adverbs', () => {
    expect(chipsForPos('adj')).toContain('komparativ');
    expect(chipsForPos('adv')).not.toContain('komparativ');
    expect(chipsForPos('noun')).not.toContain('komparativ');
  });

  it('always offers Beispiel and Erklären', () => {
    for (const pos of ['noun', 'verb', 'adj', 'adv', 'other'] as const) {
      expect(chipsForPos(pos)).toEqual(
        expect.arrayContaining(['beispiel', 'erklaeren']),
      );
    }
  });
});

describe('parseReplyLines', () => {
  it('parses a plain paragraph line', () => {
    expect(parseReplyLines('Hello world')).toEqual([
      { type: 'p', segments: [{ text: 'Hello world' }] },
    ]);
  });

  it('extracts bold segments', () => {
    expect(parseReplyLines('**Hallo** Welt')).toEqual([
      {
        type: 'p',
        segments: [{ text: 'Hallo', bold: true }, { text: ' Welt' }],
      },
    ]);
  });

  it('treats a leading "- " as a bullet line', () => {
    expect(parseReplyLines('- Du fährst mit dem Bus.')).toEqual([
      { type: 'li', segments: [{ text: 'Du fährst mit dem Bus.' }] },
    ]);
  });

  it('treats a leading "# " (or "## ", etc.) as a heading line', () => {
    expect(parseReplyLines('# Fahren')).toEqual([
      { type: 'h', segments: [{ text: 'Fahren' }] },
    ]);
    expect(parseReplyLines('## Fahren')).toEqual([
      { type: 'h', segments: [{ text: 'Fahren' }] },
    ]);
  });

  it('drops blank lines', () => {
    expect(parseReplyLines('One\n\nTwo')).toEqual([
      { type: 'p', segments: [{ text: 'One' }] },
      { type: 'p', segments: [{ text: 'Two' }] },
    ]);
  });

  it('handles multiple bold spans in one line', () => {
    expect(parseReplyLines('**A** and **B**')).toEqual([
      {
        type: 'p',
        segments: [
          { text: 'A', bold: true },
          { text: ' and ' },
          { text: 'B', bold: true },
        ],
      },
    ]);
  });
});
