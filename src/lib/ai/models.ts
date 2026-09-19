import type { WordIntent } from '@/types/ai';

// Every model id this route is allowed to call — a typo here fails
// typecheck instead of silently reaching Anthropic with a bad model string.
export const MODEL_IDS = ['claude-sonnet-5'] as const;
type ModelId = (typeof MODEL_IDS)[number];

// The tap-a-word popover runs every WordIntent on one model today — a single
// config value, not a per-intent map, so raising the bar (or later splitting
// cheap/expensive intents across models) is a one-line edit here instead of
// updating an entry per intent. `modelForIntent` is the seam call sites use,
// so that future split stays a change in this file only.
export const WORD_INTENT_MODEL: ModelId = 'claude-sonnet-5';

export function modelForIntent(_intent: WordIntent): ModelId {
  return WORD_INTENT_MODEL;
}
