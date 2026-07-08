export function choiceStyle(
  answered: boolean,
  i: number,
  selected: number | null,
  correctIndex: number,
): string {
  if (!answered) {
    return 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]';
  }
  if (i === correctIndex) {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300';
  }
  if (i === selected) {
    return 'border-rose-400/30 bg-rose-500/10 text-rose-300';
  }
  return 'border-white/5 bg-white/[0.01] text-slate-500';
}
