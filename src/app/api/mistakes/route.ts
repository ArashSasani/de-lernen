import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { loadMistakes, saveMistakes, mergeMistakes } from '@/lib/db';
import { hasControlChars, isDirectiveLike } from '@/lib/mistakes-gate';
import { isPastTimestamp } from '@/lib/validate-sync';
import {
  LEVELS,
  MISTAKE_SOURCES,
  MISTAKES_MAX_CORPUS,
  MISTAKES_MAX_NOTE_LEN,
} from '@/constants';
import type { MistakeCorpus, MistakeRecord } from '@/types/mistakes';

// The corpus cap is the upper bound on a legitimate body: a first sync from
// a device pushes every record the server is missing, up to the whole corpus.
const MAX_BODY_RECORDS = MISTAKES_MAX_CORPUS;
const MAX_ID_LEN = 200;

const SOURCES: readonly string[] = MISTAKE_SOURCES;
const LEVEL_VALUES: readonly string[] = LEVELS;

// Re-validates every record server-side (unlike dictation/progress): this
// is the one synced payload later injected into a model prompt.
function isValidRecord(value: unknown): value is MistakeRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;

  if (typeof r.id !== 'string' || !r.id || r.id.length > MAX_ID_LEN)
    return false;
  if (typeof r.source !== 'string' || !SOURCES.includes(r.source)) {
    return false;
  }
  if (
    typeof r.text !== 'string' ||
    !r.text ||
    r.text.length > MISTAKES_MAX_NOTE_LEN ||
    hasControlChars(r.text) ||
    isDirectiveLike(r.text)
  ) {
    return false;
  }
  if (!isPastTimestamp(r.createdAt)) return false;
  if (r.wordId !== undefined && typeof r.wordId !== 'string') return false;
  if (r.topicId !== undefined && typeof r.topicId !== 'string') return false;
  if (r.level !== undefined && !LEVEL_VALUES.includes(r.level as string)) {
    return false;
  }
  // A stray local-only field isn't rejected — mergeMistakes strips it.
  return true;
}

function parseMistakeCorpus(body: unknown): MistakeCorpus | null {
  if (!Array.isArray(body) || body.length > MAX_BODY_RECORDS) return null;
  const source = body as unknown[];
  const out: MistakeCorpus = [];
  for (const item of source) {
    if (!isValidRecord(item)) return null;
    out.push(item);
  }
  return out;
}

async function auth(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req);
  if (!token) return false;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const corpus = await loadMistakes();
  return NextResponse.json(corpus);
}

export async function PUT(req: NextRequest) {
  if (!(await auth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseMistakeCorpus(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const remote = await loadMistakes();
  const merged = mergeMistakes(parsed, remote);
  try {
    await saveMistakes(merged);
  } catch {
    return NextResponse.json({ error: 'Sync failed' }, { status: 502 });
  }
  return NextResponse.json(merged);
}

export { parseMistakeCorpus };
