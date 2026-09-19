import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { parseAiRequest } from '@/lib/ai/validate';
import { buildPrompt } from '@/lib/ai/prompts';
import { modelForIntent } from '@/lib/ai/models';
import { streamCompletion } from '@/lib/ai/client';

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

  const spec = buildPrompt(parsed);
  const stream = streamCompletion(modelForIntent(parsed.intent), spec);
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
