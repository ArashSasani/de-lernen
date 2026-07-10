import { kv } from '@vercel/kv';

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

const KEY_PREFIX = 'login:failed:';

type RateLimitStore = {
  get<T>(key: string): Promise<T | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
  del(...keys: string[]): Promise<unknown>;
};

function clientAddress(headers: Headers): string {
  const forwarded =
    headers.get('x-vercel-forwarded-for') ??
    headers.get('x-forwarded-for') ??
    headers.get('x-real-ip');

  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

async function keyFor(headers: Headers): Promise<string> {
  const identity = `${process.env.TOKEN_SECRET ?? ''}:${clientAddress(headers)}`;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identity),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

  return `${KEY_PREFIX}${hash}`;
}

export function createFailedLoginRateLimiter(store: RateLimitStore) {
  async function remainingWindow(key: string): Promise<number | null> {
    const ttl = await store.ttl(key);
    if (ttl > 0) return ttl;
    if (ttl === -2) return null;

    await store.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
    return LOGIN_RATE_LIMIT_WINDOW_SECONDS;
  }

  return {
    async retryAfter(headers: Headers): Promise<number | null> {
      try {
        const key = await keyFor(headers);
        const failures = (await store.get<number>(key)) ?? 0;
        if (failures < MAX_FAILED_LOGIN_ATTEMPTS) return null;
        return remainingWindow(key);
      } catch {
        // Keep login available when KV is absent in local development or down.
        return null;
      }
    },

    async recordFailure(headers: Headers): Promise<number | null> {
      try {
        const key = await keyFor(headers);
        const failures = await store.incr(key);
        if (failures === 1) {
          await store.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
        }
        if (failures < MAX_FAILED_LOGIN_ATTEMPTS) return null;
        return (await remainingWindow(key)) ?? LOGIN_RATE_LIMIT_WINDOW_SECONDS;
      } catch {
        // Fail open so a KV outage cannot lock the owner out of the app.
        return null;
      }
    },

    async reset(headers: Headers): Promise<void> {
      try {
        await store.del(await keyFor(headers));
      } catch {
        // A successful login should not fail because the counter could not clear.
      }
    },
  };
}

export const failedLoginRateLimiter = createFailedLoginRateLimiter(kv);
