'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import Chip from '@/components/shared/Chip';
import { getToken } from '@/lib/sync';
import { useAiConfigured } from '@/hooks/useAiConfigured';
import {
  isAiEnabled,
  setAiEnabled,
  getLearnerLevel,
  setLearnerLevel,
} from '@/lib/ai-prefs';
import { getTheme, setTheme, type ThemeName } from '@/lib/theme-prefs';
import { LEARNER_LEVEL_OPTIONS } from './page.helpers';
import LoadingScreen from '@/components/shared/LoadingScreen';

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [aiEnabled, setAiEnabledState] = useState(true);
  const [learnerLevel, setLearnerLevelState] =
    useState<ReturnType<typeof getLearnerLevel>>('a1');
  const [theme, setThemeState] = useState<ThemeName>('delernen-dark');
  const aiConfigured = useAiConfigured(() => router.replace('/login'));

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
      setAiEnabledState(isAiEnabled());
      setLearnerLevelState(getLearnerLevel());
      setThemeState(getTheme());
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
    return <LoadingScreen />;
  }

  const toggleAi = () => {
    if (!aiConfigured) return;
    const next = !aiEnabled;
    setAiEnabled(next);
    setAiEnabledState(next);
  };

  const toggleTheme = () => {
    const next: ThemeName =
      theme === 'delernen-dark' ? 'delernen-light' : 'delernen-dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-6 md:max-w-xl md:gap-8 md:px-10 md:py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Einstellungen
        </h1>
        <AppNav />
      </header>

      <section className="card border-base-300 bg-base-200 flex flex-col gap-3 border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Light theme</p>
            <p className="text-base-content/60 text-xs">
              Switch the app to a light color scheme. Defaults to dark.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Light theme"
            className="switch switch-primary shrink-0"
            checked={theme === 'delernen-light'}
            onChange={toggleTheme}
          />
        </div>
      </section>

      <section className="card border-base-300 bg-base-200 flex flex-col gap-3 border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">AI features</p>
            <p className="text-base-content/60 text-xs">
              {aiConfigured
                ? 'Tap-a-word chips (Genitiv, Konjugation, …) call your own key. Everything else stays offline.'
                : 'Not configured on this deployment — set ANTHROPIC_API_KEY to enable. Everything else works offline.'}
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="AI features"
            disabled={!aiConfigured}
            className="switch switch-primary shrink-0"
            checked={effectiveAiEnabled}
            onChange={toggleAi}
          />
        </div>
      </section>

      <section className="card border-base-300 bg-base-200 flex flex-col gap-3 border p-5">
        <div>
          <p className="text-sm font-medium">Learner level</p>
          <p className="text-base-content/60 text-xs">
            Caps how advanced AI explanations get, regardless of a word&apos;s
            own level.
          </p>
        </div>
        <div className="flex gap-1.5">
          {LEARNER_LEVEL_OPTIONS.map(({ value, label }) => (
            <Chip
              key={value}
              active={learnerLevel === value}
              disabled={!aiConfigured}
              onClick={() => {
                setLearnerLevel(value);
                setLearnerLevelState(value);
              }}
            >
              {label}
            </Chip>
          ))}
        </div>
      </section>
    </main>
  );
}
