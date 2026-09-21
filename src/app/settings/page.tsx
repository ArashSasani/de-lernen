'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import Chip from '@/components/shared/Chip';
import MistakesList from '@/components/MistakesList';
import { getToken } from '@/lib/sync';
import { useAiConfigured } from '@/hooks/useAiConfigured';
import { useMistakes } from '@/hooks/useMistakes';
import {
  isAiEnabled,
  setAiEnabled,
  getLearnerLevel,
  setLearnerLevel,
  isJudgeEnabled,
  setJudgeEnabled,
} from '@/lib/ai-prefs';
import { getTheme, setTheme, type ThemeName } from '@/lib/theme-prefs';
import { LEARNER_LEVEL_OPTIONS } from './page.helpers';
import LoadingScreen from '@/components/shared/LoadingScreen';

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [aiEnabled, setAiEnabledState] = useState(true);
  const [judgeEnabled, setJudgeEnabledState] = useState(false);
  const [learnerLevel, setLearnerLevelState] =
    useState<ReturnType<typeof getLearnerLevel>>('a1');
  const [theme, setThemeState] = useState<ThemeName>('delernen-dark');
  const aiConfigured = useAiConfigured(() => router.replace('/login'));
  const { mistakes } = useMistakes();

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    (async () => {
      setAiEnabledState(isAiEnabled());
      setJudgeEnabledState(isJudgeEnabled());
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

      <div className="divider text-base-content/60 text-xs font-medium tracking-wide uppercase">
        General
      </div>

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

      <div className="divider text-base-content/60 text-xs font-medium tracking-wide uppercase">
        AI
      </div>

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
            Raises how advanced AI explanations get, never below a word&apos;s
            own level and never above it unless you explicitly ask.
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

      <section className="card border-base-300 bg-base-200 flex flex-col gap-3 border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Verify learning-memory notes</p>
            <p className="text-base-content/60 text-xs">
              Adds a second AI check before a mistake note is saved. Off by
              default — the built-in checks already cover most cases.
            </p>
          </div>
          <input
            type="checkbox"
            aria-label="Verify learning-memory notes"
            disabled={!aiConfigured}
            className="switch switch-primary shrink-0"
            checked={judgeEnabled && aiConfigured}
            onChange={() => {
              const next = !judgeEnabled;
              setJudgeEnabled(next);
              setJudgeEnabledState(next);
            }}
          />
        </div>
      </section>

      <section className="card border-base-300 bg-base-200 flex flex-col gap-3 border p-5">
        <div>
          <p className="text-sm font-medium">Learning memory</p>
          <p className="text-base-content/60 text-xs">
            Notes recorded from your practice mistakes — read-only, synced
            across devices.
          </p>
        </div>
        <MistakesList mistakes={mistakes} />
      </section>
    </main>
  );
}
