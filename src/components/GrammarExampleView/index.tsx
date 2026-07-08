import type { GrammarExample } from '@/types';

export default function GrammarExampleView({
  example,
}: {
  example: GrammarExample;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm text-slate-200">{example.de}</p>
      <p className="text-xs text-slate-500">{example.en}</p>
    </div>
  );
}
