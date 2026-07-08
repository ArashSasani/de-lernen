export function speakButtonClass(speaking: boolean): string {
  return speaking
    ? 'animate-pulse text-indigo-400'
    : 'text-slate-400 hover:text-slate-200';
}
