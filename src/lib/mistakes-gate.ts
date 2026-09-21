import { MISTAKES_MAX_NOTE_LEN } from '@/constants';
import type { Level } from '@/types';
import type { MistakeCandidate, JudgeVerdict } from '@/types/ai';
import type { MistakeRecord, MistakeSource } from '@/types/mistakes';

// A discriminated union of one: nothing constructs this yet, but the quiz
// producer is next and a second track adds a variant rather than a rewrite.
export type GroundTruth = {
  kind: 'grammar-quiz';
  topicId: string;
  itemId: string;
  level: Level;
  choices: readonly string[];
  correctIndex: number;
  // Every genuinely correct index, not just correctIndex — an answer in
  // this set but not === correctIndex still grades correct on screen, so a
  // note must not be authored about it. Defaults to [correctIndex].
  acceptableIndices?: number[];
  learnerAnswerIndex: number;
};

export type GateReject =
  | 'no-gap'
  | 'empty-text'
  | 'text-too-long'
  | 'text-malformed'
  | 'learner-was-correct'
  | 'contradicts-answer'
  | 'low-confidence'
  | 'judge-rejected';

export type GateDecision =
  | { verdict: 'insert'; record: MistakeRecord }
  | { verdict: 'reject'; reason: GateReject };

export const CONFIDENCE_FLOOR = 0.65;

// Second-order prompt-injection defence: a model-authored note, persisted
// and later injected into other prompts, must not carry an instruction.
export function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

const DIRECTIVE_MARKERS = /ignore previous|system:|`|</i;
export function isDirectiveLike(s: string): boolean {
  return DIRECTIVE_MARKERS.test(s);
}

function normalize(s: string): string {
  return s.trim().toLocaleLowerCase('de').replace(/\s+/g, ' ');
}

function sourceForTruth(truth: GroundTruth): MistakeSource {
  return truth.kind;
}

function refForTruth(truth: GroundTruth): string {
  return `${truth.topicId}:${truth.itemId}`;
}

// PURE — no Date.now/crypto/IDB/fetch, so this unit-tests with no mocks.
// Layers run cheapest-first and short-circuit, so a reject skips the rest.
export function gateCandidate(
  candidate: MistakeCandidate,
  truth: GroundTruth,
  now: number,
  opts?: { confidenceFloor?: number },
): GateDecision {
  // Layer 1a — the model's escape hatch. Most exchanges reveal nothing.
  if (!candidate.found) {
    return { verdict: 'reject', reason: 'no-gap' };
  }

  // Layer 1b — hygiene, load-bearing here (not cosmetic): it's what stops
  // the corpus from becoming an injection vector.
  const text = candidate.text.trim();
  if (!text) return { verdict: 'reject', reason: 'empty-text' };
  if (text.length > MISTAKES_MAX_NOTE_LEN) {
    return { verdict: 'reject', reason: 'text-too-long' };
  }
  if (hasControlChars(candidate.text) || isDirectiveLike(text)) {
    return { verdict: 'reject', reason: 'text-malformed' };
  }

  // Layer 1c — grounded validation against the interaction's ground truth.
  const acceptable = truth.acceptableIndices ?? [truth.correctIndex];
  if (acceptable.includes(truth.learnerAnswerIndex)) {
    return { verdict: 'reject', reason: 'learner-was-correct' };
  }
  const correctChoice = truth.choices[truth.correctIndex];
  const learnerChoice = truth.choices[truth.learnerAnswerIndex];
  if (
    (correctChoice &&
      normalize(text).includes(`${normalize(correctChoice)} is wrong`)) ||
    (learnerChoice &&
      normalize(text).includes(`${normalize(learnerChoice)} is right`))
  ) {
    return { verdict: 'reject', reason: 'contradicts-answer' };
  }

  // Layer 2 — confidence floor.
  const floor = opts?.confidenceFloor ?? CONFIDENCE_FLOOR;
  if (candidate.confidence < floor) {
    return { verdict: 'reject', reason: 'low-confidence' };
  }

  // Ids and backlinks come from ground truth, never the model.
  const source = sourceForTruth(truth);
  const ref = refForTruth(truth);
  const record: MistakeRecord = {
    id: `${source}:${ref}:${now}`,
    source,
    text,
    createdAt: now,
    topicId: truth.topicId,
    level: truth.level, // from ground truth; the model's own level is advisory
    confidence: candidate.confidence,
  };
  return { verdict: 'insert', record };
}

// Layer 3 — opt-in judge. Runs the pure gate first (a reject costs nothing)
// and fails OPEN by default, so a network blip can't empty the corpus.
export async function gateCandidateWithJudge(
  candidate: MistakeCandidate,
  truth: GroundTruth,
  now: number,
  judge: (
    candidate: MistakeCandidate,
    truth: GroundTruth,
  ) => Promise<JudgeVerdict | null>,
  opts?: { confidenceFloor?: number; failOpen?: boolean },
): Promise<GateDecision> {
  const decision = gateCandidate(candidate, truth, now, opts);
  if (decision.verdict === 'reject') return decision;

  let verdict: JudgeVerdict | null;
  try {
    verdict = await judge(candidate, truth);
  } catch {
    verdict = null;
  }
  if (!verdict) {
    return (opts?.failOpen ?? true)
      ? decision
      : { verdict: 'reject', reason: 'judge-rejected' };
  }
  if (!verdict.keep) {
    return { verdict: 'reject', reason: 'judge-rejected' };
  }
  return decision;
}
