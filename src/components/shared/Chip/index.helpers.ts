export function chipClass(active: boolean, disabled: boolean): string {
  const base =
    'badge cursor-pointer border-none px-3 py-3 text-xs font-normal transition-colors';
  const state = active ? 'badge-primary' : 'badge-soft badge-secondary';
  const disabledState = disabled ? 'cursor-not-allowed opacity-50' : '';
  return [base, state, disabledState].filter(Boolean).join(' ');
}
