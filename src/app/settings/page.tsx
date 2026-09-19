'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import { getToken } from '@/lib/sync';
import { useAiConfigured } from '@/hooks/useAiConfigured';
import {
  isAiEnabled,
  setAiEnabled,
  getLearnerLevel,
  setLearnerLevel,
} from '@/lib/ai-prefs';
import { LEARNER_LEVEL_OPTIONS } from './page.helpers';

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [aiEnabled, setAiEnabledState] = useState(true);
  const [learnerLevel, setLearnerLevelState] =
    useState<ReturnType<typeof getLearnerLevel>>('a1');
  const aiConfigured = useAiConfigured(() => router.replace('/login'));

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
      setAiEnabledState(isAiEnabled());
      setLearnerLevelState(getLearnerLevel());
      setReady(true);
    })();
  }, [router]);

  // Deployed without ANTHROPIC_API_KEY: the toggle can never be honored, so
  // it reads as off regardless of the stored preference, and the stored
  // preference itself is persisted as off so it doesn't stay stale.
  const effectiveAiEnabled = aiEnabled && aiConfigured;

  useEffect(() => {
    if (ready && !aiConfigured && aiEnabled) setAiEnabled(false);
  }, [ready, aiConfigured, aiEnabled]);

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center text-slate-400">
        Loading…
      </main>
    );
  }

  const toggleAi = () => {
    if (!aiConfigured) return;
    const next = !aiEnabled;
    setAiEnabled(next);
    setAiEnabledState(next);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-6 md:max-w-xl md:gap-8 md:px-10 md:py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Einstellungen
        </h1>
        <AppNav />
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-200">AI features</p>
            <p className="text-xs text-slate-500">
              {aiConfigured
                ? 'Tap-a-word chips (Genitiv, Konjugation, …) call your own key. Everything else stays offline.'
                : 'Not configured on this deployment — set ANTHROPIC_API_KEY to enable. Everything else works offline.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={effectiveAiEnabled}
            aria-label="AI features"
            disabled={!aiConfigured}
            onClick={toggleAi}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              effectiveAiEnabled ? 'bg-indigo-500' : 'bg-white/10'
            } ${!aiConfigured ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                effectiveAiEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div>
          <p className="text-sm font-medium text-slate-200">Learner level</p>
          <p className="text-xs text-slate-500">
            Caps how advanced AI explanations get, regardless of a word&apos;s
            own level.
          </p>
        </div>
        <div className="flex gap-1.5">
          {LEARNER_LEVEL_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={learnerLevel === value}
              disabled={!aiConfigured}
              onClick={() => {
                setLearnerLevel(value);
                setLearnerLevelState(value);
              }}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                learnerLevel === value
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              } ${!aiConfigured ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
