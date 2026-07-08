'use client';

import { useCallback, useEffect, useState } from 'react';
import { getGermanVoice, speakDE } from '@/lib/speech';

export function useSpeech() {
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    getGermanVoice().then((voice) => setAvailable(voice !== null));
    return () => {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    setSpeaking(true);
    speakDE(text).then(
      () => setSpeaking(false),
      () => setSpeaking(false),
    );
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { available, speaking, speak, stop };
}
