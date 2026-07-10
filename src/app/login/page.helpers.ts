import type { LoginResult } from '@/types/auth';

export function formatRetryAfter(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// POST the password to /api/login and map the outcome to a flat result the
// component can render. Network/parse failures are reported, never thrown.
export async function requestLogin(password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      return {
        ok: false,
        error: 'Too many attempts.',
        retryAfter:
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1,
      };
    }
    if (!res.ok) return { ok: false, error: 'Wrong password.' };
    const { token } = await res.json();
    return { ok: true, token };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}
