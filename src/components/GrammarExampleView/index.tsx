import type { GrammarExample } from '@/types';

export default function GrammarExampleView({
  example,
}: {
  example: GrammarExample;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm">{example.de}</p>
      <p className="text-base-content/60 text-xs">{example.en}</p>
    </div>
  );
}
