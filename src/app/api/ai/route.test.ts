import { NextRequest } from 'next/server';
import { verifyToken } from '../../../lib/auth';
import { streamCompletion, completeStructured } from '../../../lib/ai/client';
import { GET, POST } from './route';

jest.mock('../../../lib/auth', () => ({
  getTokenFromRequest: jest.fn((req: NextRequest) => {
    const header = req.headers.get('authorization');
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
  }),
  verifyToken: jest.fn(),
}));

jest.mock('../../../lib/ai/client', () => ({
  streamCompletion: jest.fn(),
  completeStructured: jest.fn(),
}));

const mockedVerifyToken = jest.mocked(verifyToken);
const mockedStreamCompletion = jest.mocked(streamCompletion);
const mockedCompleteStructured = jest.mocked(completeStructured);

const validWord = {
  lemma: 'Haus',
  article: 'das',
  plural: 'Häuser',
  en: 'house',
};

function aiRequest(body: unknown, token = 'valid-token'): NextRequest {
  return new NextRequest('https://example.test/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function aiStatusRequest(token = 'valid-token'): NextRequest {
  return new NextRequest('https://example.test/api/ai', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('POST /api/ai', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockedVerifyToken.mockResolvedValue(true);
    mockedStreamCompletion.mockReturnValue(new ReadableStream());
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('returns 401 when no token is present', async () => {
    const request = new NextRequest('https://example.test/api/ai', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 401 when the token is invalid', async () => {
    mockedVerifyToken.mockResolvedValue(false);
    const response = await POST(
      aiRequest({ intent: 'erklaeren', level: 'a1', word: validWord }),
    );
    expect(response.status).toBe(401);
  });

  it('returns 503 when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await POST(
      aiRequest({ intent: 'erklaeren', level: 'a1', word: validWord }),
    );
    expect(response.status).toBe(503);
  });

  it('returns 400 for a malformed body', async () => {
    const response = await POST(aiRequest({ intent: 'not-real' }));
    expect(response.status).toBe(400);
    expect(mockedStreamCompletion).not.toHaveBeenCalled();
  });

  it('streams a valid request with the right model and content type', async () => {
    const response = await POST(
      aiRequest({ intent: 'genitiv', level: 'a1', word: validWord }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(mockedStreamCompletion).toHaveBeenCalledTimes(1);
    const [model, spec] = mockedStreamCompletion.mock.calls[0];
    expect(model).toBe('claude-sonnet-5');
    expect(spec.maxTokens).toBeGreaterThan(0);
  });

  it('returns structured JSON for a note request without streaming', async () => {
    mockedCompleteStructured.mockResolvedValue({
      ok: true,
      value: {
        found: true,
        text: 'asked why mit takes Dativ',
        evidence: 'why does mit take Dativ',
        confidence: 0.9,
        claimedLemma: 'mit',
      },
    });

    const response = await POST(
      aiRequest({
        intent: 'note',
        level: 'a1',
        source: 'tap-a-word',
        word: validWord,
        exchange: {
          question: 'why does mit take Dativ',
          reply: 'mit is always followed by Dativ.',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(mockedStreamCompletion).not.toHaveBeenCalled();
    expect(mockedCompleteStructured).toHaveBeenCalledTimes(1);
    const [model] = mockedCompleteStructured.mock.calls[0];
    expect(model).toBe('claude-sonnet-5');
    await expect(response.json()).resolves.toEqual({
      found: true,
      text: 'asked why mit takes Dativ',
      evidence: 'why does mit take Dativ',
      confidence: 0.9,
      claimedLemma: 'mit',
    });
  });

  it('returns 502 when the structured intent fails', async () => {
    mockedCompleteStructured.mockResolvedValue({
      ok: false,
      reason: 'provider',
    });

    const response = await POST(
      aiRequest({
        intent: 'note',
        level: 'a1',
        source: 'tap-a-word',
        word: validWord,
        exchange: {
          question: 'why does mit take Dativ',
          reply: 'mit is always followed by Dativ.',
        },
      }),
    );

    expect(response.status).toBe(502);
    expect(mockedStreamCompletion).not.toHaveBeenCalled();
  });
});

describe('GET /api/ai', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockedVerifyToken.mockResolvedValue(true);
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('returns 401 when no token is present', async () => {
    const request = new NextRequest('https://example.test/api/ai', {
      method: 'GET',
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns 401 when the token is invalid', async () => {
    mockedVerifyToken.mockResolvedValue(false);
    const response = await GET(aiStatusRequest());
    expect(response.status).toBe(401);
  });

  it('reports configured: true when ANTHROPIC_API_KEY is set', async () => {
    const response = await GET(aiStatusRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ configured: true });
  });

  it('reports configured: false when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const response = await GET(aiStatusRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ configured: false });
  });
});
