import type { GrammarTable } from '@/types';

export default function GrammarTableView({ table }: { table: GrammarTable }) {
  const colCount = table.headers.length;
  return (
    <div className="overflow-x-auto">
      {table.caption && (
        <p className="text-base-content/60 mb-1 text-xs font-medium">
          {table.caption}
        </p>
      )}
      <table className="table-sm table w-full border-collapse">
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th
                key={i}
                className="border-base-300 bg-base-200 text-base-content/80 border px-3 py-2 text-left text-xs font-medium"
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
                  className="border-base-300 text-base-content/80 border px-3 py-2 text-xs"
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
