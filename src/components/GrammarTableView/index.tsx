import type { GrammarTable } from '@/types';

export default function GrammarTableView({ table }: { table: GrammarTable }) {
  const colCount = table.headers.length;
  return (
    <div className="overflow-x-auto">
      {table.caption && (
        <p className="mb-1 text-xs font-medium text-slate-400">
          {table.caption}
        </p>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th
                key={i}
                className="border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-medium text-slate-300"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {Array.from({ length: colCount }, (_, ci) => (
                <td
                  key={ci}
                  className="border border-white/10 px-3 py-2 text-xs text-slate-300"
                >
                  {row[ci] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
