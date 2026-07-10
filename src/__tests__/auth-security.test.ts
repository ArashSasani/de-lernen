import {
  createFailedLoginRateLimiter,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from '@/lib/auth-security';

function createStore() {
  const values = new Map<string, number>();
  const ttls = new Map<string, number>();

  return {
    values,
    store: {
      get: async <T>(key: string) => (values.get(key) as T | undefined) ?? null,
      incr: async (key: string) => {
        const next = (values.get(key) ?? 0) + 1;
        values.set(key, next);
        return next;
      },
      expire: async (key: string, seconds: number) => {
        if (!values.has(key)) return 0;
        ttls.set(key, seconds);
        return 1;
      },
      ttl: async (key: string) => {
        if (!values.has(key)) return -2;
        return ttls.get(key) ?? -1;
      },
      del: async (...keys: string[]) => {
        let deleted = 0;
        for (const key of keys) {
          if (values.delete(key)) deleted += 1;
          ttls.delete(key);
        }
        return deleted;
      },
    },
  };
}

describe('failed login rate limiter', () => {
  const headers = new Headers({ 'x-forwarded-for': '192.0.2.1' });

  beforeEach(() => {
    process.env.TOKEN_SECRET = 'test-token-secret';
  });

  it('blocks on the configured failed attempt and returns the window', async () => {
    const { store } = createStore();
    const limiter = createFailedLoginRateLimiter(store);

    for (let attempt = 1; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      await expect(limiter.recordFailure(headers)).resolves.toBeNull();
    }

    await expect(limiter.recordFailure(headers)).resolves.toBe(
      LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    );
    await expect(limiter.retryAfter(headers)).resolves.toBe(
      LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    );
  });

  it('keeps counters separate by forwarded client address', async () => {
    const { store } = createStore();
    const limiter = createFailedLoginRateLimiter(store);
    const otherHeaders = new Headers({ 'x-forwarded-for': '198.51.100.2' });

    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      await limiter.recordFailure(headers);
    }

    await expect(limiter.retryAfter(headers)).resolves.toBe(
      LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    );
    await expect(limiter.retryAfter(otherHeaders)).resolves.toBeNull();
  });

  it('clears failures after a successful login', async () => {
    const { store } = createStore();
    const limiter = createFailedLoginRateLimiter(store);

    await limiter.recordFailure(headers);
    await limiter.reset(headers);

    await expect(limiter.retryAfter(headers)).resolves.toBeNull();
  });

  it('fails open when the rate-limit store is unavailable', async () => {
    const unavailable = async () => {
      throw new Error('KV unavailable');
    };
    const limiter = createFailedLoginRateLimiter({
      get: unavailable,
      incr: unavailable,
      expire: unavailable,
      ttl: unavailable,
      del: unavailable,
    });

    await expect(limiter.retryAfter(headers)).resolves.toBeNull();
    await expect(limiter.recordFailure(headers)).resolves.toBeNull();
    await expect(limiter.reset(headers)).resolves.toBeUndefined();
  });
});
