import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import {
  parseAiRequest,
  parseMistakeCandidate,
  parseJudgeVerdict,
} from '@/lib/ai/validate';
import { buildPrompt, buildStructuredPrompt } from '@/lib/ai/prompts';
import { modelForIntent } from '@/lib/ai/models';
import { streamCompletion, completeStructured } from '@/lib/ai/client';

// Edge: Vercel Hobby serverless functions cap execution/streaming duration.
export const runtime = 'edge';

async function auth(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req);
  if (!token) return false;
  return verifyToken(token);
}

// Lets the client know up front whether the BYOK layer is configured on this
// deployment, so Settings can auto-disable the AI toggle instead of surfacing
// a 503 only after the user taps a chip.
export async function GET(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

export async function POST(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    // 503, not 500: this is the expected "optional layer unconfigured" case
    // per spec §4, not a server error — the client tells it apart from a
    // transient failure by status code.
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseAiRequest(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // note/judge are non-streaming, JSON-returning structured intents — a
  // parallel branch that leaves the tap-a-word streaming path below
  // untouched. Two calls, not one generic call with a picked parser: the
  // conditional-expression form doesn't narrow to a single T for
  // completeStructured<T>.
  if (parsed.intent === 'note') {
    const spec = buildStructuredPrompt(parsed);
    const result = await completeStructured(
      modelForIntent(parsed.intent),
      spec,
      parseMistakeCandidate,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: 'AI request failed', reason: result.reason },
        { status: 502 },
      );
    }
    return NextResponse.json(result.value, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (parsed.intent === 'judge') {
    const spec = buildStructuredPrompt(parsed);
    const result = await completeStructured(
      modelForIntent(parsed.intent),
      spec,
      parseJudgeVerdict,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: 'AI request failed', reason: result.reason },
        { status: 502 },
      );
    }
    return NextResponse.json(result.value, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const spec = buildPrompt(parsed);
  const stream = streamCompletion(modelForIntent(parsed.intent), spec);
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
