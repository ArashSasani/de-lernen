import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import type { PromptSpec, StructuredPromptSpec } from './prompts';

// Derived from the SDK helper's own parameter type rather than importing
// `json-schema-to-ts` (a transitive dep of @anthropic-ai/sdk, not a direct
// one) — keeps prompts.ts's StructuredToolSchema a plain, dependency-free
// shape and confines the SDK's stricter JSON-Schema type to this one call.
type AnthropicJsonSchema = Parameters<typeof jsonSchemaOutputFormat>[0];

// The one network/SDK-touching piece of the AI proxy — isolated so the route
// handler stays thin and this can be mocked in route tests.
export function streamCompletion(
  model: string,
  spec: PromptSpec,
): ReadableStream<Uint8Array> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model,
          max_tokens: spec.maxTokens,
          system: spec.system,
          messages: [{ role: 'user', content: spec.user }],
        });
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        // Otherwise a bad key / rate limit / network error reaches the user
        // as a bare "AI request failed" with nothing in the server logs.
        console.error('[ai] streamCompletion failed:', err);
        controller.error(err);
      }
    },
  });
}

export type StructuredResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'provider' | 'no_output' | 'schema' | 'truncated' };

// The structured-output counterpart to streamCompletion, for the note/judge/
// grammar intents. Uses jsonSchemaOutputFormat — raw JSON Schema, no zod, no
// forced tool_choice (the pre-structured-outputs workaround). `parse`
// re-validates the model's output with the same discipline the route applies
// to client input; a model that ignores its own schema surfaces as a 'schema'
// result, not a thrown error.
//
// messages.create() + an explicit JSON.parse, not messages.parse(): the SDK's
// auto-parse throws on a body cut mid-string, which discards stop_reason and
// reports a max_tokens overrun as an opaque provider error.
export async function completeStructured<T>(
  model: string,
  spec: StructuredPromptSpec,
  parse: (input: unknown) => T | null,
): Promise<StructuredResult<T>> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: spec.maxTokens,
      system: spec.system,
      messages: [{ role: 'user', content: spec.user }],
      output_config: {
        format: jsonSchemaOutputFormat(spec.schema as AnthropicJsonSchema),
      },
    });
    const text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
    if (!text) return { ok: false, reason: 'no_output' };

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      // The API treats the schema's maxLength/maxItems as advisory prose, so
      // an over-long answer runs past max_tokens and lands here.
      const reason =
        message.stop_reason === 'max_tokens' ? 'truncated' : 'schema';
      console.error(
        `[ai] completeStructured ${reason}: stop_reason=${message.stop_reason}, ${text.length} chars of unparseable output`,
      );
      return { ok: false, reason };
    }

    const value = parse(raw);
    return value !== null
      ? { ok: true, value }
      : { ok: false, reason: 'schema' };
  } catch (err) {
    console.error('[ai] completeStructured failed:', err);
    return { ok: false, reason: 'provider' };
  }
}
