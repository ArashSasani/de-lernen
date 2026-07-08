import type { GrammarTopic } from '@/types';
import type { QuizQuestion } from '@/types/grammar-quiz';
import { grammarTopics } from './grammar';
import { allWords } from './words';
import { shuffle } from './shuffle';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildChoices(correct: string, pool: string[], count = 4): string[] {
  const others = pool.filter(
    (v) => v !== correct && v !== '' && v !== '—' && v !== '–',
  );
  const distractors = shuffle(others).slice(0, count - 1);
  const choices = shuffle([correct, ...distractors]);
  return choices;
}

// ─── Conjugation-based questions ───────────────────────────────────

function generateConjugation(topic: GrammarTopic): QuizQuestion | null {
  const table = topic.tables.find(
    (t) => t.headers.includes('Person') && t.rows.length >= 4,
  );
  if (!table) return null;

  const formColIndex =
    table.headers.indexOf('Form') !== -1
      ? table.headers.indexOf('Form')
      : // For multi-verb tables, pick a random verb column (skip Person)
        1 + Math.floor(Math.random() * (table.headers.length - 1));

  if (formColIndex < 1 || formColIndex >= table.headers.length) return null;

  const row = pick(table.rows);
  const person = row[0];
  const correct = row[formColIndex];
  if (!correct || correct === '—') return null;

  const allForms = table.rows
    .map((r) => r[formColIndex])
    .filter((v) => v && v !== '—');
  if (allForms.length < 3) return null;

  const infinitive = table.caption
    ? table.caption.split('(')[0].split(',')[0].split('/')[0].trim()
    : table.headers[formColIndex] || '';

  const prompt = infinitive ? `${person} ___ (${infinitive})` : `${person} ___`;

  const choices = buildChoices(correct, allForms);
  const correctIndex = choices.indexOf(correct);

  return { topicId: topic.id, prompt, choices, correctIndex };
}

// ─── Modal verb questions ──────────────────────────────────────────

function generateModalVerb(topic: GrammarTopic): QuizQuestion | null {
  const table = topic.tables[0];
  if (!table || table.rows.length < 4) return null;

  const row = pick(table.rows);
  // Columns: Verb, ich/er, du, wir, ihr, sie/Sie, Bedeutung
  const verb = row[0];
  const personIndex = 1 + Math.floor(Math.random() * 5); // columns 1-5
  const personLabels = ['ich / er/sie/es', 'du', 'wir', 'ihr', 'sie/Sie'];
  const person = personLabels[personIndex - 1];
  const correct = row[personIndex];
  if (!correct) return null;

  // Use the other person-forms of the SAME verb as distractors so the student
  // must choose the correct conjugation, not just spot the matching infinitive.
  const sameVerbForms = [...new Set(row.slice(1, 6).filter(Boolean))];
  const prompt = `${person} ___ (${verb})`;
  const choices = buildChoices(correct, sameVerbForms);

  return {
    topicId: topic.id,
    prompt,
    choices,
    correctIndex: choices.indexOf(correct),
  };
}

// ─── Article gender questions (using words.json nouns) ─────────────

function generateArticleGender(topic: GrammarTopic): QuizQuestion | null {
  const nouns = allWords.filter((w) => w.pos === 'noun' && w.article);
  if (nouns.length === 0) return null;

  const word = pick(nouns);
  const correct = word.article!;
  const prompt = `___ ${word.lemma}`;
  const choices = shuffle(['der', 'die', 'das']);

  return {
    topicId: topic.id,
    prompt,
    choices,
    correctIndex: choices.indexOf(correct),
    hint: word.en,
  };
}

// ─── Unbestimmter Artikel: ein / eine / einen ──────────────────────

function generateUnbestimmterArtikel(topic: GrammarTopic): QuizQuestion | null {
  const nouns = allWords.filter((w) => w.pos === 'noun' && w.article);
  if (nouns.length === 0) return null;

  const word = pick(nouns);
  // feminin → eine; maskulin/neutrum → ein (Nominativ context)
  const correct = word.article === 'die' ? 'eine' : 'ein';
  const prompt = `Das ist ___ ${word.lemma}.`;
  // 'einen' (Akkusativ maskulin) is a plausible distractor that tests case+gender
  const choices = shuffle(['ein', 'eine', 'einen']);

  return {
    topicId: topic.id,
    prompt,
    choices,
    correctIndex: choices.indexOf(correct),
    hint: word.en,
  };
}

// ─── Case declension questions ─────────────────────────────────────

const CASE_EXAMPLES: {
  template: string;
  case_: string;
  gender: string;
}[] = [
  { template: 'Ich sehe ___ Mann.', case_: 'Akkusativ', gender: 'maskulin' },
  { template: 'Ich helfe ___ Frau.', case_: 'Dativ', gender: 'feminin' },
  {
    template: 'Ich gebe ___ Kind einen Ball.',
    case_: 'Dativ',
    gender: 'neutrum',
  },
  {
    template: 'Er kauft ___ Apfel.',
    case_: 'Akkusativ',
    gender: 'maskulin',
  },
  { template: '___ Mann ist groß.', case_: 'Nominativ', gender: 'maskulin' },
  { template: '___ Frau liest.', case_: 'Nominativ', gender: 'feminin' },
  {
    template: 'Ich rufe ___ Bruder an.',
    case_: 'Akkusativ',
    gender: 'maskulin',
  },
  { template: 'Sie hilft ___ Lehrer.', case_: 'Dativ', gender: 'maskulin' },
  {
    template: 'Wir geben ___ Kindern Geschenke.',
    case_: 'Dativ',
    gender: 'Plural',
  },
  { template: 'Er trinkt ___ Kaffee.', case_: 'Akkusativ', gender: 'maskulin' },
  { template: 'Das Buch gehört ___ Frau.', case_: 'Dativ', gender: 'feminin' },
  { template: 'Ich kenne ___ Film.', case_: 'Akkusativ', gender: 'maskulin' },
];

const CASE_TABLE: Record<string, Record<string, string>> = {
  Nominativ: { maskulin: 'der', feminin: 'die', neutrum: 'das', Plural: 'die' },
  Akkusativ: { maskulin: 'den', feminin: 'die', neutrum: 'das', Plural: 'die' },
  Dativ: { maskulin: 'dem', feminin: 'der', neutrum: 'dem', Plural: 'den' },
};

function generateCaseDeclension(topic: GrammarTopic): QuizQuestion | null {
  const ex = pick(CASE_EXAMPLES);
  const correct = CASE_TABLE[ex.case_]?.[ex.gender];
  if (!correct) return null;

  const allArticles = ['der', 'die', 'das', 'den', 'dem'];
  const choices = buildChoices(correct, allArticles);

  return {
    topicId: topic.id,
    prompt: ex.template,
    choices,
    correctIndex: choices.indexOf(correct),
    hint: `${ex.case_} — ${ex.gender}`,
  };
}

// ─── Pronoun questions ─────────────────────────────────────────────

function generatePronoun(topic: GrammarTopic): QuizQuestion | null {
  const table = topic.tables[0];
  if (!table || table.rows.length < 4) return null;

  const row = pick(table.rows);
  const nominativ = row[0];

  // Find the target column (last column before "English")
  const targetCol = table.headers.length >= 4 ? table.headers.length - 2 : 1;
  const caseName = table.headers[targetCol];
  const correct = row[targetCol];
  if (!correct || correct === nominativ) return null;

  const allForms = table.rows.map((r) => r[targetCol]).filter(Boolean);
  const prompt = `${nominativ} → ${caseName}: ___`;
  const choices = buildChoices(correct, allForms);

  return {
    topicId: topic.id,
    prompt,
    choices,
    correctIndex: choices.indexOf(correct),
  };
}

// ─── Preposition questions ─────────────────────────────────────────

const PREP_AKK = ['für', 'ohne', 'durch', 'gegen', 'um'];
const PREP_DAT = ['mit', 'nach', 'bei', 'von', 'zu', 'aus'];

const PREP_SENTENCES: { template: string; correct: string }[] = [
  { template: 'Das Geschenk ist ___ meinen Bruder.', correct: 'für' },
  { template: 'Ich gehe ___ dich.', correct: 'ohne' },
  { template: 'Wir gehen ___ den Park.', correct: 'durch' },
  { template: 'Ich fahre ___ dem Auto.', correct: 'mit' },
  { template: 'Sie kommt ___ der Türkei.', correct: 'aus' },
  { template: 'Wir gehen ___ Arzt.', correct: 'zum' },
  { template: 'Ich fahre ___ Berlin.', correct: 'nach' },
  { template: 'Er arbeitet ___ der Firma.', correct: 'bei' },
  { template: 'Das Buch ist ___ meinem Freund.', correct: 'von' },
  { template: 'Wir laufen ___ den Tisch.', correct: 'um' },
  { template: 'Er läuft ___ die Wand.', correct: 'gegen' },
  { template: 'Ich gehe ___ Hause.', correct: 'nach' },
];

function generatePreposition(topic: GrammarTopic): QuizQuestion | null {
  const isAkk = topic.id === 'praepositionen-akkusativ';
  const relevant = PREP_SENTENCES.filter((s) =>
    isAkk
      ? PREP_AKK.includes(s.correct)
      : PREP_DAT.includes(s.correct) || s.correct === 'zum',
  );
  if (relevant.length === 0) return null;

  const sent = pick(relevant);
  const correct = sent.correct;
  // Mix both Akkusativ and Dativ prepositions so the student must
  // distinguish which case the correct preposition governs.
  const pool = [...PREP_AKK, ...PREP_DAT, 'zum'];
  const choices = buildChoices(correct, pool);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(correct),
  };
}

// ─── Perfekt haben vs sein ─────────────────────────────────────────

const PERFEKT_SENTENCES: { template: string; correct: 'haben' | 'sein' }[] = [
  { template: 'Ich ___ einen Kaffee getrunken.', correct: 'haben' },
  { template: 'Wir ___ nach Berlin gefahren.', correct: 'sein' },
  { template: 'Sie ___ das Buch gelesen.', correct: 'haben' },
  { template: 'Er ___ nach Hause gegangen.', correct: 'sein' },
  { template: 'Wir ___ viel gearbeitet.', correct: 'haben' },
  { template: 'Der Bus ___ pünktlich gekommen.', correct: 'sein' },
  { template: 'Ich ___ gestern ins Kino gegangen.', correct: 'sein' },
  { template: 'Sie ___ in München studiert.', correct: 'haben' },
  { template: 'Wir ___ nach Italien geflogen.', correct: 'sein' },
  { template: 'Du ___ gut geschlafen.', correct: 'haben' },
  { template: 'Ich ___ das Wort verstanden.', correct: 'haben' },
  { template: 'Sie ___ früh aufgestanden.', correct: 'sein' },
  { template: 'Er ___ die Tür aufgemacht.', correct: 'haben' },
  { template: 'Wir ___ lange geblieben.', correct: 'sein' },
  { template: 'Ich ___ einen Film gesehen.', correct: 'haben' },
];

function generatePerfektHelper(topic: GrammarTopic): QuizQuestion | null {
  const isHaben = topic.id === 'perfekt-mit-haben';
  const relevant = PERFEKT_SENTENCES.filter((s) =>
    isHaben ? s.correct === 'haben' : s.correct === 'sein',
  );
  const sent = pick(relevant);

  // Extract subject to conjugate the helper
  const subject = sent.template.split(' ')[0];
  let correctForm: string;
  if (sent.correct === 'haben') {
    if (subject === 'Ich') correctForm = 'habe';
    else if (subject === 'Du') correctForm = 'hast';
    else if (subject === 'Wir') correctForm = 'haben';
    else correctForm = 'hat';
  } else {
    if (subject === 'Ich') correctForm = 'bin';
    else if (subject === 'Du') correctForm = 'bist';
    else if (subject === 'Wir') correctForm = 'sind';
    else correctForm = 'ist';
  }

  const habenForms = ['habe', 'hast', 'hat', 'haben'];
  const seinForms = ['bin', 'bist', 'ist', 'sind'];
  const pool = [...habenForms, ...seinForms];

  const choices = buildChoices(correctForm, pool);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(correctForm),
  };
}

// ─── Negation: nicht vs kein ───────────────────────────────────────

const NEGATION_SENTENCES: { template: string; correct: string }[] = [
  { template: 'Ich habe ___ Auto.', correct: 'kein' },
  { template: 'Das ist ___ gut.', correct: 'nicht' },
  { template: 'Wir haben ___ Zeit.', correct: 'keine' },
  { template: 'Ich kenne den Mann ___.', correct: 'nicht' },
  { template: 'Das ist ___ richtig.', correct: 'nicht' },
  { template: 'Ich habe ___ Geld.', correct: 'kein' },
  { template: 'Sie hat ___ Schwester.', correct: 'keine' },
  { template: 'Er kommt heute ___.', correct: 'nicht' },
  { template: 'Das ist ___ mein Buch.', correct: 'nicht' },
  { template: 'Ich habe ___ Frage.', correct: 'keine' },
  { template: 'Er trinkt ___ Kaffee.', correct: 'keinen' },
  { template: 'Der Kaffee ist ___ heiß.', correct: 'nicht' },
];

function generateNegation(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(NEGATION_SENTENCES);
  const choices = buildChoices(sent.correct, [
    'nicht',
    'kein',
    'keine',
    'keinen',
  ]);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
  };
}

// ─── Example-based (fallback for any topic) ────────────────────────

function generateFromExample(topic: GrammarTopic): QuizQuestion | null {
  if (topic.examples.length === 0) return null;

  const ex = pick(topic.examples);
  const words = ex.de.replace(/[?!.,]/g, '').split(' ');
  if (words.length < 3) return null;

  // Pick a word to blank (avoid first word and very short words)
  const candidates = words
    .map((w, i) => ({ w, i }))
    .filter(({ w, i }) => i > 0 && w.length > 2);
  if (candidates.length === 0) return null;

  const target = pick(candidates);
  const blanked = words.map((w, i) => (i === target.i ? '___' : w)).join(' ');

  // Distractors from other examples in the same topic
  const otherWords = topic.examples
    .flatMap((e) => e.de.replace(/[?!.,]/g, '').split(' '))
    .filter((w) => w.length > 2 && w !== target.w);

  if (otherWords.length < 2) return null;

  const choices = buildChoices(target.w, otherWords);

  return {
    topicId: topic.id,
    prompt: blanked,
    choices,
    correctIndex: choices.indexOf(target.w),
    hint: ex.en,
  };
}

// ─── Separable verbs ───────────────────────────────────────────────

// Only the separated prefix is tested — students see the conjugated stem
// in context and must recall which prefix belongs at the end.
const TRENNBAR_SENTENCES: { template: string; correct: string }[] = [
  { template: 'Ich stehe um 7 Uhr ___.', correct: 'auf' },
  { template: 'Wir kaufen im Supermarkt ___.', correct: 'ein' },
  { template: 'Der Zug kommt um 9 Uhr ___.', correct: 'an' },
  { template: 'Wann fängt der Film ___?', correct: 'an' },
  { template: 'Sie ruft ihre Mutter ___.', correct: 'an' },
  { template: 'Ich hole dich ___.', correct: 'ab' },
];

const TRENNBAR_PREFIXES = ['auf', 'an', 'ein', 'aus', 'mit', 'ab', 'zu', 'vor'];

function generateTrennbar(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(TRENNBAR_SENTENCES);
  const choices = buildChoices(sent.correct, TRENNBAR_PREFIXES);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
  };
}

// ─── Imperativ ─────────────────────────────────────────────────────

function generateImperativ(topic: GrammarTopic): QuizQuestion | null {
  const table = topic.tables[0];
  if (!table || table.rows.length < 3) return null;

  const row = pick(table.rows);
  const verb = row[0];
  // Columns: Verb, du, ihr, Sie
  const formIndex = 1 + Math.floor(Math.random() * 3);
  const formLabels = ['du', 'ihr', 'Sie'];
  const formLabel = formLabels[formIndex - 1];
  const correct = row[formIndex];
  if (!correct) return null;

  // Primary distractors: the other two imperative forms of the SAME verb.
  // This forces the student to pick the right person-form, not just the right verb.
  const sameVerbOtherForms = [row[1], row[2], row[3]].filter(
    (v): v is string => Boolean(v) && v !== correct,
  );
  // One cross-verb form pads to 4 choices when needed.
  const crossVerbForm = shuffle(
    table.rows
      .filter((r) => r !== row)
      .map((r) => r[formIndex])
      .filter(Boolean),
  )[0];
  const pool = [
    ...sameVerbOtherForms,
    ...(crossVerbForm ? [crossVerbForm] : []),
  ];

  const prompt = `Imperativ (${formLabel}) von „${verb}":`;
  const choices = shuffle([correct, ...pool.slice(0, 3)]);

  return {
    topicId: topic.id,
    prompt,
    choices,
    correctIndex: choices.indexOf(correct),
  };
}

// ─── Partizip II ───────────────────────────────────────────────────

// Generate plausible wrong Partizip II forms of the SAME verb so that
// choices can't be dismissed by simply recognising which verb they come from.
function wrongPartizipForms(infinitive: string, correct: string): string[] {
  const stem = infinitive.replace(/en$/, ''); // mach, trink, studier
  if (correct.startsWith('ge') && !correct.endsWith('en')) {
    // Regular: gemacht → ge+stem+en (kept -en), stem+t (forgot ge-)
    return ['ge' + stem + 'en', stem + 't'];
  } else if (correct.startsWith('ge') && correct.endsWith('en')) {
    // Strong: getrunken → ge+stem+t (wrong regular rule), infinitive
    return ['ge' + stem + 't', infinitive];
  } else {
    // -ieren: studiert → gestudiert (added ge-), infinitive
    return ['ge' + correct, infinitive];
  }
}

function generatePartizipZwei(topic: GrammarTopic): QuizQuestion | null {
  const table0 = topic.tables.find((t) => t.headers.includes('Infinitive'));
  const table1 = topic.tables.find((t) => t.headers.includes('Infinitiv'));
  if (!table0 || table0.rows.length < 2) return null;

  const infCol = table0.headers.indexOf('Infinitive');
  const partCol = table0.headers.indexOf('Partizip II');
  if (infCol === -1 || partCol === -1) return null;

  const row = pick(table0.rows);
  const infinitive = row[infCol];
  const correct = row[partCol];
  if (!infinitive || !correct) return null;

  // Plausible wrong forms of this specific verb
  const wrongs = wrongPartizipForms(infinitive, correct).filter(
    (f) => f !== correct,
  );

  // Cross-verb form from same table (or table1) as a 4th choice if needed
  const pool0 = table0.rows
    .filter((r) => r !== row)
    .map((r) => r[partCol])
    .filter(Boolean);
  const pool1 = table1 ? table1.rows.map((r) => r[1]).filter(Boolean) : [];
  const crossForm = shuffle(
    [...pool0, ...pool1].filter((f) => f !== correct && !wrongs.includes(f)),
  )[0];

  const pool = [...wrongs, ...(crossForm ? [crossForm] : [])];
  const choices = shuffle([correct, ...pool.slice(0, 3)]);

  const prompt = `Partizip II von „${infinitive}":`;
  return {
    topicId: topic.id,
    prompt,
    choices,
    correctIndex: choices.indexOf(correct),
  };
}

// ─── Possessive articles ───────────────────────────────────────────

const POSSESSIV_SENTENCES: { template: string; correct: string }[] = [
  { template: 'Das ist ___ Schwester. (ich)', correct: 'meine' },
  { template: 'Wo ist ___ Auto? (du)', correct: 'dein' },
  { template: 'Ich kenne ___ Bruder. (er)', correct: 'seinen' },
  { template: 'Ich helfe ___ Freund. (ich)', correct: 'meinem' },
  { template: '___ Mutter arbeitet. (sie/she)', correct: 'Ihre' },
  { template: 'Wo sind ___ Schlüssel? (wir)', correct: 'unsere' },
  { template: 'Das ist ___ Buch. (er)', correct: 'sein' },
  { template: 'Ich sehe ___ Hund. (du)', correct: 'deinen' },
];

function generatePossessiv(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(POSSESSIV_SENTENCES);
  const pool = [
    'mein',
    'meine',
    'meinen',
    'meinem',
    'dein',
    'deine',
    'deinen',
    'deinem',
    'sein',
    'seine',
    'seinen',
    'seinem',
    'ihr',
    'ihre',
    'ihren',
    'ihrem',
    'unser',
    'unsere',
    'unseren',
    'unserem',
    'Ihr',
    'Ihre',
    'Ihren',
    'Ihrem',
  ];
  const choices = buildChoices(sent.correct, pool);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
  };
}

// ─── Temporal prepositions ─────────────────────────────────────────

const TEMPORAL_SENTENCES: { template: string; correct: string }[] = [
  { template: 'Der Kurs beginnt ___ 9 Uhr.', correct: 'um' },
  { template: '___ Samstag gehe ich einkaufen.', correct: 'Am' },
  { template: '___ Winter ist es kalt.', correct: 'Im' },
  { template: 'Ich wohne ___ drei Jahren in Berlin.', correct: 'seit' },
  { template: 'Ich arbeite ___ 9 ___ 17 Uhr.', correct: 'von … bis' },
  { template: '___ morgen lerne ich Deutsch.', correct: 'Ab' },
  { template: '___ dem Essen gehe ich spazieren.', correct: 'Nach' },
  { template: '___ zwei Tagen war ich krank.', correct: 'Vor' },
];

function generateTemporalPrep(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(TEMPORAL_SENTENCES);
  const pool = [
    'um',
    'am',
    'im',
    'seit',
    'von … bis',
    'ab',
    'nach',
    'vor',
    'Am',
    'Im',
    'Ab',
    'Nach',
    'Vor',
  ];
  const choices = buildChoices(sent.correct, pool);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
  };
}

// ─── W-Fragen ──────────────────────────────────────────────────────

const W_FRAGEN_SENTENCES: { template: string; correct: string }[] = [
  { template: '___ wohnst du?', correct: 'Wo' },
  { template: '___ heißen Sie?', correct: 'Wie' },
  { template: '___ kommst du?', correct: 'Woher' },
  { template: '___ beginnt der Kurs?', correct: 'Wann' },
  { template: '___ lernst du Deutsch?', correct: 'Warum' },
  { template: '___ ist das?', correct: 'Wer' },
  { template: '___ machst du?', correct: 'Was' },
  { template: '___ gehst du?', correct: 'Wohin' },
];

function generateWFragen(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(W_FRAGEN_SENTENCES);
  const pool = ['Wo', 'Wie', 'Woher', 'Wann', 'Warum', 'Wer', 'Was', 'Wohin'];
  const choices = buildChoices(sent.correct, pool);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
  };
}

// ─── Lokale Präpositionen (wo/wohin) ───────────────────────────────

const LOKAL_SENTENCES: { template: string; correct: string; hint: string }[] = [
  { template: 'Ich bin ___ Park. (wo?)', correct: 'im', hint: 'Dativ — wo?' },
  {
    template: 'Ich gehe ___ den Park. (wohin?)',
    correct: 'in',
    hint: 'Akkusativ — wohin?',
  },
  {
    template: 'Sie fährt ___ die Schweiz.',
    correct: 'in',
    hint: 'Akkusativ — wohin?',
  },
  { template: 'Wir sitzen ___ Fenster.', correct: 'am', hint: 'Dativ — wo?' },
  {
    template: 'Die Kinder laufen ___ Wasser.',
    correct: 'ans',
    hint: 'Akkusativ — wohin?',
  },
  {
    template: 'Er fährt ___ Berlin.',
    correct: 'nach',
    hint: 'Stadt / Land ohne Artikel',
  },
  { template: 'Wir gehen ___ Arzt.', correct: 'zum', hint: 'zu + dem' },
  {
    template: 'Ich komme ___ der Schule.',
    correct: 'aus',
    hint: 'woher? — aus + Dativ',
  },
];

function generateLokalPrep(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(LOKAL_SENTENCES);
  const pool = [
    'im',
    'in',
    'am',
    'ans',
    'ins',
    'nach',
    'zum',
    'zur',
    'aus',
    'von',
  ];
  const choices = buildChoices(sent.correct, pool);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
    hint: sent.hint,
  };
}

// ─── Ja/Nein-Fragen: verb-first fill-in ────────────────────────────

function generateJaNeinFrage(topic: GrammarTopic): QuizQuestion | null {
  const table = topic.tables[0];
  if (!table || table.rows.length < 2) return null;

  // Table: Verb (Pos. 1) | Subject | Rest
  const row = pick(table.rows);
  const verb = row[0];
  const subjectRest = `${row[1]} ${row[2]}`;
  const prompt = `___ ${subjectRest}`;

  // Distractors: verbs from other table rows + first words from examples
  const tableVerbs = table.rows
    .filter((r) => r !== row)
    .map((r) => r[0])
    .filter(Boolean);
  const exampleVerbs = topic.examples
    .map((e) => e.de.split(' ')[0])
    .filter((v) => v && !v.includes('_'));
  const pool = [...new Set([...tableVerbs, ...exampleVerbs])];

  const choices = buildChoices(verb, pool);
  if (choices.length < 3) return null;

  return {
    topicId: topic.id,
    prompt,
    choices,
    correctIndex: choices.indexOf(verb),
  };
}

// ─── Konjunktionen: blank the conjunction ──────────────────────────

const KONJUNKTION_SENTENCES: { template: string; correct: string }[] = [
  { template: 'Ich lerne Deutsch ___ ich höre Musik.', correct: 'und' },
  { template: 'Sie ist müde, ___ sie arbeitet.', correct: 'aber' },
  { template: 'Ich bleibe zu Hause, ___ ich bin krank.', correct: 'denn' },
  { template: 'Möchtest du Tee ___ Kaffee?', correct: 'oder' },
  { template: 'Ich bin müde, ___ ich schlafe nicht.', correct: 'aber' },
  {
    template: 'Er lernt Deutsch, ___ er arbeitet in Deutschland.',
    correct: 'denn',
  },
  { template: 'Ich kaufe Brot ___ Butter.', correct: 'und' },
  { template: 'Kommst du heute ___ morgen?', correct: 'oder' },
  { template: 'Sie singt ___ tanzt sehr gut.', correct: 'und' },
  { template: 'Ich mag Kaffee, ___ ich trinke lieber Tee.', correct: 'aber' },
];

const KONJUNKTIONEN = ['und', 'oder', 'aber', 'denn'];

function generateKonjunktion(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(KONJUNKTION_SENTENCES);
  const choices = buildChoices(sent.correct, KONJUNKTIONEN);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
  };
}

// ─── Adverbien: English → German translation ────────────────────────
// Fill-in-the-blank is avoided because frequency adverbs (immer, selten, etc.)
// are interchangeable in position and make any blanked sentence ambiguous.

function generateAdverb(topic: GrammarTopic): QuizQuestion | null {
  // Only use tables that have both Adverb and English columns.
  const validTables = topic.tables.filter((t) => {
    const aCol = t.headers.indexOf('Adverb');
    const eCol = t.headers.indexOf('English');
    return aCol !== -1 && eCol !== -1 && t.rows.some((r) => r[aCol] && r[eCol]);
  });
  if (validTables.length === 0) return null;

  const table = pick(validTables);
  const adverbCol = table.headers.indexOf('Adverb');
  const englishCol = table.headers.indexOf('English');

  const validRows = table.rows.filter((r) => r[adverbCol] && r[englishCol]);
  if (validRows.length === 0) return null;

  const row = pick(validRows);
  const adverb = row[adverbCol];
  const english = row[englishCol];
  if (!adverb || !english) return null;

  // Pool: all adverbs from every table in this topic for richer distractors.
  const pool = topic.tables.flatMap((t) => {
    const col = t.headers.indexOf('Adverb');
    return col !== -1 ? t.rows.map((r) => r[col]).filter(Boolean) : [];
  });
  const choices = buildChoices(adverb, pool);
  if (choices.length < 3) return null;

  return {
    topicId: topic.id,
    prompt: `„${english}" auf Deutsch:`,
    choices,
    correctIndex: choices.indexOf(adverb),
  };
}

// ─── Verben mit Akkusativ: choose correct Akkusativ article ────────

const VERB_AKK_SENTENCES: {
  template: string;
  correct: string;
  hint: string;
}[] = [
  {
    template: 'Ich brauche ___ Stift.',
    correct: 'einen',
    hint: 'maskulin → Akkusativ',
  },
  {
    template: 'Siehst du ___ Mann?',
    correct: 'den',
    hint: 'maskulin → Akkusativ',
  },
  {
    template: 'Er trinkt ___ Kaffee.',
    correct: 'einen',
    hint: 'maskulin → Akkusativ',
  },
  {
    template: 'Sie kauft ___ Tasche.',
    correct: 'eine',
    hint: 'feminin → Akkusativ',
  },
  {
    template: 'Ich lese ___ Buch.',
    correct: 'ein',
    hint: 'neutrum → Akkusativ',
  },
  {
    template: 'Er kocht ___ Essen.',
    correct: 'das',
    hint: 'neutrum → Akkusativ',
  },
  {
    template: 'Ich finde ___ Schlüssel.',
    correct: 'den',
    hint: 'maskulin → Akkusativ',
  },
  {
    template: 'Wir machen ___ Ausflug.',
    correct: 'einen',
    hint: 'maskulin → Akkusativ',
  },
  {
    template: 'Ich verstehe ___ Frage.',
    correct: 'die',
    hint: 'feminin → Akkusativ',
  },
  {
    template: 'Ich nehme ___ Bus.',
    correct: 'den',
    hint: 'maskulin → Akkusativ',
  },
  {
    template: 'Kennst du ___ Film?',
    correct: 'den',
    hint: 'maskulin → Akkusativ',
  },
  {
    template: 'Er fragt ___ Lehrer.',
    correct: 'den',
    hint: 'maskulin → Akkusativ',
  },
];

function generateVerbMitAkkusativ(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(VERB_AKK_SENTENCES);
  const pool = ['den', 'die', 'das', 'einen', 'eine', 'ein'];
  const choices = buildChoices(sent.correct, pool);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
    hint: sent.hint,
  };
}

// ─── Verben mit Dativ: choose correct Dativ pronoun/article ─────────

const VERB_DAT_SENTENCES: {
  template: string;
  correct: string;
  hint: string;
}[] = [
  { template: 'Kannst du ___ helfen?', correct: 'mir', hint: 'ich → Dativ' },
  { template: 'Das Kleid gefällt ___ .', correct: 'mir', hint: 'ich → Dativ' },
  { template: 'Ich helfe ___ .', correct: 'dir', hint: 'du → Dativ' },
  { template: 'Ich danke ___ .', correct: 'dir', hint: 'du → Dativ' },
  {
    template: 'Die Schuhe passen ___ nicht.',
    correct: 'ihr',
    hint: 'sie (she) → Dativ',
  },
  {
    template: 'Das Buch gehört ___ Lehrer.',
    correct: 'dem',
    hint: 'der Lehrer → Dativ',
  },
  { template: 'Die Suppe schmeckt ___ .', correct: 'uns', hint: 'wir → Dativ' },
  { template: 'Du fehlst ___ sehr.', correct: 'mir', hint: 'ich → Dativ' },
  { template: 'Der Kopf tut ___ weh.', correct: 'ihm', hint: 'er → Dativ' },
  { template: 'Ich glaube ___ .', correct: 'dir', hint: 'du → Dativ' },
  { template: 'Wir gratulieren ___ !', correct: 'dir', hint: 'du → Dativ' },
  { template: 'Das Kleid steht ___ gut.', correct: 'dir', hint: 'du → Dativ' },
];

function generateVerbMitDativ(topic: GrammarTopic): QuizQuestion | null {
  const sent = pick(VERB_DAT_SENTENCES);
  const pool = [
    'mir',
    'dir',
    'ihm',
    'ihr',
    'uns',
    'euch',
    'ihnen',
    'dem',
    'der',
  ];
  const choices = buildChoices(sent.correct, pool);

  return {
    topicId: topic.id,
    prompt: sent.template,
    choices,
    correctIndex: choices.indexOf(sent.correct),
    hint: sent.hint,
  };
}

// ─── Ordinalzahlen: number → ordinal form ──────────────────────────

function generateOrdinalzahl(topic: GrammarTopic): QuizQuestion | null {
  const table = topic.tables[0];
  if (!table || table.rows.length < 4) return null;

  const zahlCol = table.headers.indexOf('Zahl');
  const ordinalCol = table.headers.indexOf('Ordinalzahl');
  if (zahlCol === -1 || ordinalCol === -1) return null;

  const row = pick(table.rows);
  const zahl = row[zahlCol];
  const ordinal = row[ordinalCol];
  if (!zahl || !ordinal) return null;

  const pool = table.rows.map((r) => r[ordinalCol]).filter(Boolean);
  const choices = buildChoices(ordinal, pool);

  return {
    topicId: topic.id,
    prompt: `Ordinalzahl von ${zahl}:`,
    choices,
    correctIndex: choices.indexOf(ordinal),
  };
}

// ─── Plural forms (using words.json nouns) ─────────────────────────

function generatePlural(topic: GrammarTopic): QuizQuestion | null {
  const nouns = allWords.filter(
    (w) => w.pos === 'noun' && w.plural && w.plural !== '—',
  );
  if (nouns.length < 4) return null;

  const word = pick(nouns);
  const correct = word.plural!;
  const prompt = `Plural von „${word.lemma}":`;
  const pool = nouns.map((w) => w.plural!).filter(Boolean);
  const choices = buildChoices(correct, pool);

  return {
    topicId: topic.id,
    prompt,
    choices,
    correctIndex: choices.indexOf(correct),
    hint: word.en,
  };
}

// ─── Registry ──────────────────────────────────────────────────────

type Generator = (topic: GrammarTopic) => QuizQuestion | null;

const GENERATORS: Record<string, Generator> = {
  'praesens-regelmaessig': generateConjugation,
  'praesens-rechtschreibung': generateConjugation,
  'sein-praesens': generateConjugation,
  'haben-praesens': generateConjugation,
  'verben-stammvokalwechsel': generateConjugation,
  'praeteritum-haben-sein': generateConjugation,
  modalverben: generateModalVerb,
  'trennbare-verben': generateTrennbar,
  'perfekt-mit-haben': generatePerfektHelper,
  'perfekt-mit-sein': generatePerfektHelper,
  'partizip-zwei': generatePartizipZwei,
  imperativ: generateImperativ,
  'bestimmter-artikel': generateArticleGender,
  'unbestimmter-artikel': generateUnbestimmterArtikel,
  'negativartikel-kein': generateNegation,
  'nominativ-akkusativ-dativ': generateCaseDeclension,
  'personalpronomen-nominativ': generatePronoun,
  'personalpronomen-akkusativ': generatePronoun,
  'personalpronomen-dativ': generatePronoun,
  possessivartikel: generatePossessiv,
  'negation-nicht-kein': generateNegation,
  'position-von-nicht': generateNegation,
  'praepositionen-akkusativ': generatePreposition,
  'praepositionen-dativ': generatePreposition,
  'lokale-praepositionen': generateLokalPrep,
  'temporale-praepositionen': generateTemporalPrep,
  'w-fragen': generateWFragen,
  'verb-position-zwei': generateFromExample,
  'ja-nein-fragen': generateJaNeinFrage,
  'konjunktionen-und-oder-aber': generateKonjunktion,
  'satzstellung-temporal-modal-lokal': generateFromExample,
  adverbien: generateAdverb,
  'verben-mit-akkusativ': generateVerbMitAkkusativ,
  'verben-mit-dativ': generateVerbMitDativ,
  ordinalzahlen: generateOrdinalzahl,
  'plural-nomen': generatePlural,
  'praepositionen-ab-bis-von-bis': generateFromExample,
  'kontraktionen-ins-ans': generateLokalPrep,
  'unbestimmte-pronomen': generateFromExample,
  'frageartikel-welcher': generateFromExample,
  'demonstrativartikel-der-die-das': generateFromExample,
};

// Topics explicitly excluded from quizzes (reference-only content).
const NO_QUIZ_TOPICS = new Set(['nomen-grossschreibung']);

export function isQuizzableTopic(topicId: string): boolean {
  return !NO_QUIZ_TOPICS.has(topicId);
}

export function generateQuestion(topicId: string): QuizQuestion | null {
  if (NO_QUIZ_TOPICS.has(topicId)) return null;
  const topic = grammarTopics.find((t) => t.id === topicId);
  if (!topic) return null;

  const gen = GENERATORS[topicId] ?? generateFromExample;
  for (let attempt = 0; attempt < 5; attempt++) {
    const q = gen(topic);
    if (q && q.choices.length >= 3) return q;
  }
  return generateFromExample(topic);
}

export function generateQuestionsForTopic(
  topicId: string,
  count: number,
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count * 3 && questions.length < count; i++) {
    const q = generateQuestion(topicId);
    if (q && !seen.has(q.prompt)) {
      seen.add(q.prompt);
      questions.push(q);
    }
  }
  return questions;
}

export function allQuizzableTopicIds(): string[] {
  return grammarTopics
    .filter(
      (t) =>
        !NO_QUIZ_TOPICS.has(t.id) &&
        (GENERATORS[t.id] || t.examples.length >= 3),
    )
    .map((t) => t.id);
}
