import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { loadProgress, saveProgress, mergeProgress } from '@/lib/db';
import type { ProgressMap } from '@/types';

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
  const body: ProgressMap = await req.json().catch(() => ({}));
  const remote = await loadProgress();
  const merged = mergeProgress(body, remote);
  try {
    await saveProgress(merged);
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 502 });
  }
  return NextResponse.json(merged);
}
