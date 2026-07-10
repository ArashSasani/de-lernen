import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';
import { failedLoginRateLimiter } from '@/lib/auth-security';

export const runtime = 'edge';

function rateLimited(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many attempts' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
    },
  );
}

export async function POST(req: NextRequest) {
  const blockedFor = await failedLoginRateLimiter.retryAfter(req.headers);
  if (blockedFor !== null) return rateLimited(blockedFor);

  const { password } = await req.json().catch(() => ({}));
  if (!password || password !== process.env.APP_PASSWORD) {
    const retryAfter = await failedLoginRateLimiter.recordFailure(req.headers);
    if (retryAfter !== null) return rateLimited(retryAfter);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await failedLoginRateLimiter.reset(req.headers);
  const token = await signToken();
  return NextResponse.json({ token });
}
