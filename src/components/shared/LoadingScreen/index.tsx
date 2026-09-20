import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function LoadingScreen() {
  return (
    <main
      role="status"
      aria-label="Loading"
      className="flex flex-1 items-center justify-center"
    >
      <ArrowPathIcon
        className="text-base-content/60 h-6 w-6 animate-spin md:h-8 md:w-8"
        aria-hidden="true"
      />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
