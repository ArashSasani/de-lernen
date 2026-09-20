export function choiceStyle(
  answered: boolean,
  i: number,
  selected: number | null,
  correctIndex: number,
): string {
  if (!answered) {
    return 'border-base-300 bg-base-200 text-base-content/80 hover:bg-base-300';
  }
  if (i === correctIndex) {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 light:text-emerald-700';
  }
  if (i === selected) {
    return 'border-rose-400/30 bg-rose-500/10 text-rose-300 light:text-rose-700';
  }
  return 'border-base-300/50 bg-base-200/50 text-base-content/60';
}
