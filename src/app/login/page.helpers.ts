import type { LoginResult } from '@/types/auth';

// POST the password to /api/login and map the outcome to a flat result the
// component can render. Network/parse failures are reported, never thrown.
export async function requestLogin(password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return { ok: false, error: 'Wrong password.' };
    const { token } = await res.json();
    return { ok: true, token };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}
