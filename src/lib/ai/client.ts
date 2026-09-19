import Anthropic from '@anthropic-ai/sdk';
import type { PromptSpec } from './prompts';

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
