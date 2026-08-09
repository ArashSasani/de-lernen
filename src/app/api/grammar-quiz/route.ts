import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { loadGrammarQuiz, saveGrammarQuiz, mergeGrammarQuiz } from '@/lib/db';
import type { GrammarQuizProgressMap } from '@/types/grammar-quiz';

async function auth(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req);
  if (!token) return false;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const progress = await loadGrammarQuiz();
  return NextResponse.json(progress);
}

export async function PUT(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body: GrammarQuizProgressMap = await req.json().catch(() => ({}));
  const remote = await loadGrammarQuiz();
  const merged = mergeGrammarQuiz(body, remote);
  try {
    await saveGrammarQuiz(merged);
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 502 });
  }
  return NextResponse.json(merged);
}
