'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, setToken } from '@/lib/sync';
import { formatRetryAfter, requestLogin } from './page.helpers';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace('/study');
  }, [router]);

  useEffect(() => {
    if (retryAfter === null) return;

    const timer = window.setTimeout(() => {
      setRetryAfter((remaining) => {
        if (remaining === null || remaining <= 1) return null;
        return remaining - 1;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [retryAfter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (retryAfter !== null) return;

    setError(null);
    setLoading(true);
    const result = await requestLogin(password);
    if (!result.ok) {
      setRetryAfter(result.retryAfter ?? null);
      setError(result.retryAfter ? null : (result.error ?? 'Wrong password.'));
      setLoading(false);
      return;
    }
    setToken(result.token!);
    router.replace('/study');
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-5"
      >
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">de·lernen</h1>
          <p className="mt-1 text-sm text-slate-400">Spaced repetition</p>
        </div>
        <input
          type="password"
          inputMode="text"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base transition-colors outline-none focus:border-indigo-400/60"
        />
        {retryAfter !== null ? (
          <p aria-live="polite" className="text-sm text-rose-400">
            Too many attempts. Try again in {formatRetryAfter(retryAfter)}.
          </p>
        ) : (
          error && (
            <p aria-live="polite" className="text-sm text-rose-400">
              {error}
            </p>
          )
        )}
        <button
          type="submit"
          disabled={loading || !password || retryAfter !== null}
          className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-medium text-white transition-colors hover:bg-indigo-400 disabled:bg-white/5 disabled:text-slate-500"
        >
          {loading ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </main>
  );
}
