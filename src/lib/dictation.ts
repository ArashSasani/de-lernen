import type { Word } from '@/types';

export interface Gap {
  before: string;
  gap: string;
  after: string;
  hintType: string;
  fullLemma: string;
}

const SEPARABLE_PREFIXES = [
  'zurück',
  'heraus',
  'hinaus',
  'heran',
  'hinein',
  'herein',
  'raus',
  'rein',
  'weg',
  'hin',
  'her',
  'mit',
  'nach',
  'vor',
  'bei',
  'auf',
  'aus',
  'ein',
  'an',
  'ab',
  'zu',
  'um',
];

interface Rule {
  id: string;
  pattern: RegExp;
  label: string;
}

const RULES: Rule[] = [
  { id: 'umlaut', pattern: /([äöüÄÖÜ])/, label: 'umlaut' },
  { id: 'eszett', pattern: /(ß)/, label: 'eszett' },
  { id: 'ie', pattern: /(ie)/i, label: 'ie/ei' },
  { id: 'ei', pattern: /(ei)/i, label: 'ie/ei' },
  // vowel+h before consonant or end (silent h): "Bahn", "fahren", "Wohnung"
  {
    id: 'silent-h',
    pattern: /([aeiouäöü]h)(?=[^aeiouäöüh]|$)/i,
    label: 'silent-h',
  },
  { id: 'sch', pattern: /(sch)/i, label: 'sch' },
  // ch not preceded by s (would be sch)
  { id: 'ch', pattern: /(?<!s)(ch)/i, label: 'ch' },
  { id: 'tz', pattern: /(tz)/i, label: 'tz' },
  { id: 'ck', pattern: /(ck)/i, label: 'ck' },
  {
    id: 'double',
    pattern: /(bb|dd|ff|gg|kk|ll|mm|nn|pp|rr|ss|tt)/i,
    label: 'double',
  },
  // z not preceded by t (would be tz)
  { id: 'z', pattern: /(?<!t)(z)/i, label: 'z' },
  // fallback: first vowel cluster
  { id: 'vowel', pattern: /([aeiouäöü]+)/i, label: 'vowel' },
];

function pickLongestToken(lemma: string): { token: string; idx: number } {
  const tokens = lemma.split(' ');
  let best = { token: tokens[0], idx: 0 };
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].length > best.token.length)
      best = { token: tokens[i], idx: i };
  }
  return best;
}

function stripPrefix(token: string): { prefix: string; stem: string } {
  const lower = token.toLowerCase();
  for (const p of SEPARABLE_PREFIXES) {
    if (lower.startsWith(p) && token.length > p.length + 1) {
      return { prefix: token.slice(0, p.length), stem: token.slice(p.length) };
    }
  }
  return { prefix: '', stem: token };
}

function applyRules(
  stem: string,
): { gapStr: string; before: string; after: string; hintType: string } | null {
  for (const rule of RULES) {
    const m = rule.pattern.exec(stem);
    if (m && m[1]) {
      const idx = m.index + (m[0].length - m[1].length);
      return {
        gapStr: m[1],
        before: stem.slice(0, idx),
        after: stem.slice(idx + m[1].length),
        hintType: rule.label,
      };
    }
  }
  return null;
}

export function generateGap(word: Word): Gap {
  const lemma = word.lemma;
  const { token, idx: tokenIdx } = pickLongestToken(lemma);
  const tokens = lemma.split(' ');

  const { prefix, stem } = stripPrefix(token);
  const result = applyRules(stem);

  let before: string;
  let gap: string;
  let after: string;
  let hintType: string;

  if (result) {
    before = prefix + result.before;
    gap = result.gapStr;
    after = result.after;
    hintType = result.hintType;
  } else {
    // Absolute fallback: gap the middle character
    const mid = Math.floor(stem.length / 2);
    before = prefix + stem.slice(0, mid);
    gap = stem.slice(mid, mid + 1) || stem[0];
    after = stem.slice(mid + 1);
    hintType = 'vowel';
  }

  // Reassemble multi-word tokens
  const tokensBefore = tokens.slice(0, tokenIdx);
  const tokensAfter = tokens.slice(tokenIdx + 1);
  const prefixStr = tokensBefore.length > 0 ? tokensBefore.join(' ') + ' ' : '';
  const suffixStr = tokensAfter.length > 0 ? ' ' + tokensAfter.join(' ') : '';

  return {
    before: prefixStr + before,
    gap,
    after: after + suffixStr,
    hintType,
    fullLemma: lemma,
  };
}
