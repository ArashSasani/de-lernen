let cachedVoice: SpeechSynthesisVoice | null | undefined = undefined;

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const de = voices.filter((v) => v.lang.startsWith('de'));
  if (de.length === 0) return null;
  return (
    de.find((v) => /enhanced/i.test(v.name)) ??
    de.find((v) => /google/i.test(v.name)) ??
    de[0]
  );
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getGermanVoice(): Promise<SpeechSynthesisVoice | null> {
  if (!speechSupported()) return Promise.resolve(null);

  if (cachedVoice !== undefined) return Promise.resolve(cachedVoice);

  const immediate = pickBestVoice(window.speechSynthesis.getVoices());
  if (immediate) {
    cachedVoice = immediate;
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      cachedVoice = null;
      resolve(null);
    }, 2000);

    function onVoices() {
      clearTimeout(timeout);
      window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      const voice = pickBestVoice(window.speechSynthesis.getVoices());
      cachedVoice = voice;
      resolve(voice);
    }

    window.speechSynthesis.addEventListener('voiceschanged', onVoices);
  });
}

export function speakDE(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getGermanVoice().then((voice) => {
      if (!voice) {
        reject(new Error('No German voice available'));
        return;
      }

      window.speechSynthesis.cancel();

      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const doSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE';
        utterance.voice = voice;
        utterance.rate = 0.9;
        utterance.onend = () => resolve();
        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
          // 'interrupted' / 'canceled' are fired when cancel() is called (e.g.
          // rapid taps, component unmount). These are expected — treat as success.
          if (e.error === 'interrupted' || e.error === 'canceled') {
            resolve();
          } else {
            reject(new Error(e.error ?? 'speech-error'));
          }
        };
        window.speechSynthesis.speak(utterance);
      };

      if (isIOS) {
        setTimeout(doSpeak, 50);
      } else {
        doSpeak();
      }
    });
  });
}
