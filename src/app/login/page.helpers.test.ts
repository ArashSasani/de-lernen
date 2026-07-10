import { formatRetryAfter, requestLogin } from './page.helpers';

const mockFetch = (impl: () => Promise<unknown> | unknown) => {
  (globalThis as { fetch: unknown }).fetch = jest.fn(impl);
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('formatRetryAfter', () => {
  it('formats seconds as minutes and zero-padded seconds', () => {
    expect(formatRetryAfter(65)).toBe('1:05');
  });
});

describe('requestLogin', () => {
  it('returns the token on a successful login', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ token: 'jwt-abc' }),
    }));
    const result = await requestLogin('hunter2');
    expect(result).toEqual({ ok: true, token: 'jwt-abc' });
  });

  it('reports a wrong password on a non-ok response', async () => {
    mockFetch(async () => ({ ok: false, json: async () => ({}) }));
    const result = await requestLogin('nope');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Wrong password.');
    expect(result.token).toBeUndefined();
  });

  it('reports a retry delay when login is rate limited', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '120' }),
    }));

    await expect(requestLogin('nope')).resolves.toEqual({
      ok: false,
      error: 'Too many attempts.',
      retryAfter: 120,
    });
  });

  it('reports a network error when the request throws', async () => {
    mockFetch(async () => {
      throw new Error('offline');
    });
    const result = await requestLogin('whatever');
    expect(result).toEqual({ ok: false, error: 'Could not reach the server.' });
  });

  it('posts the password to /api/login as JSON', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ token: 't' }) }));
    await requestLogin('s3cret');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 's3cret' }),
      }),
    );
  });
});
