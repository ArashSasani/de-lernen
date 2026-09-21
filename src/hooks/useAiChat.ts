'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Level } from '@/types';
import type { WordIntent, AiWordFields } from '@/types/ai';
import { getToken, clearToken } from '@/lib/sync';
import { getLearnerLevel } from '@/lib/ai-prefs';

interface AiChatState {
  reply: string;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: AiChatState = { reply: '', loading: false, error: null };

export function useAiChat(onUnauthorized?: () => void) {
  const [state, setState] = useState<AiChatState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  // Refreshed every render so `ask` can stay a dependency-free useCallback.
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  const ask = useCallback(
    (
      intent: WordIntent,
      word: AiWordFields,
      level: Level,
      question?: string,
    ) => {
      const token = getToken();
      if (!token) {
        onUnauthorizedRef.current?.();
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ reply: '', loading: true, error: null });

      (async () => {
        try {
          const res = await fetch('/api/ai', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              intent,
              level,
              learnerLevel: getLearnerLevel(),
              word,
              ...(intent === 'ask' ? { question } : {}),
            }),
            signal: controller.signal,
          });

          if (res.status === 401) {
            clearToken();
            onUnauthorizedRef.current?.();
            setState((s) => ({ ...s, loading: false, error: 'Unauthorized' }));
            return;
          }
          if (res.status === 503) {
            setState((s) => ({
              ...s,
              loading: false,
              error: 'AI not configured',
            }));
            return;
          }
          if (!res.ok || !res.body) {
            setState((s) => ({
              ...s,
              loading: false,
              error: 'AI request failed',
            }));
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            setState((s) => ({ ...s, reply: s.reply + chunk }));
          }
          // Flush any multi-byte char (ä/ö/ü/ß are common in German replies)
          // left buffered across the final chunk boundary.
          const tail = decoder.decode();
          if (tail) setState((s) => ({ ...s, reply: s.reply + tail }));
          setState((s) => ({ ...s, loading: false }));
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          setState((s) => ({
            ...s,
            loading: false,
            error: 'AI request failed',
          }));
        }
      })();
    },
    [],
  );

  // Abort any in-flight request on unmount so the stream can't keep running
  // (and billing) after the component is gone.
  useEffect(() => () => abortRef.current?.abort(), []);

  return { ...state, ask, reset };
}
