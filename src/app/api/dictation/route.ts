import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { loadDictation, saveDictation, mergeDictation } from '@/lib/db';
import type { DictationProgressMap } from '@/types/dictation';

async function auth(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req);
  if (!token) return false;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const progress = await loadDictation();
  return NextResponse.json(progress);
}

export async function PUT(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body: DictationProgressMap = await req.json().catch(() => ({}));
  const remote = await loadDictation();
  const merged = mergeDictation(body, remote);
  try {
    await saveDictation(merged);
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 502 });
  }
  return NextResponse.json(merged);
}
