'use client';

import { useEffect, useState } from 'react';
import { getToken, clearToken } from '@/lib/sync';

// Optimistic default (true): a deployment without ANTHROPIC_API_KEY is the
// exception, and staying optimistic until the check resolves avoids a flash
// of "disabled" on every load. Offline or a failed check just keeps this.
export function useAiConfigured(onUnauthorized?: () => void): boolean {
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const res = await fetch('/api/ai', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          clearToken();
          onUnauthorized?.();
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data && typeof data.configured === 'boolean') {
          setConfigured(data.configured);
        }
      } catch {
        // offline or request failed — keep the optimistic default
      }
    })();
  }, [onUnauthorized]);

  return configured;
}
