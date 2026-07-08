export function shouldRegisterServiceWorker(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    process.env.NODE_ENV === 'production'
  );
}

export function registerServiceWorker(): void {
  if (!shouldRegisterServiceWorker()) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // registration failures are non-fatal; app still works online
  });
}
