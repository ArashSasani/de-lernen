import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { loadProgress, saveProgress, mergeProgress } from '@/lib/db';
import { parseProgressMap } from '@/lib/validate-sync';

async function auth(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req);
  if (!token) return false;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const progress = await loadProgress();
  return NextResponse.json(progress);
}

export async function PUT(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseProgressMap(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const remote = await loadProgress();
  const merged = mergeProgress(parsed, remote);
  try {
    await saveProgress(merged);
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 502 });
  }
  return NextResponse.json(merged);
}
