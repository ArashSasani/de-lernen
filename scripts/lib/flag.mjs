import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = new URL('../../', import.meta.url).pathname;
const SOURCES_DIR = join(ROOT, 'data/sources');

/**
 * Create a flagger for a given source.
 * Usage:
 *   const flag = createFlagger('telc-a1-1', { level: 'a1' });
 *   flag({ page: 3, rawLine: '...', reason: 'ambiguous continuation' });
 *   flag.save();
 */
export function createFlagger(sourceName, { level } = {}) {
  const flags = [];
  const dir = level ? join(SOURCES_DIR, level) : SOURCES_DIR;
  const flagPath = join(dir, `${sourceName}_flagged.json`);

  function flag(entry) {
    flags.push(entry);
  }

  flag.save = function () {
    writeFileSync(flagPath, JSON.stringify(flags, null, 2) + '\n', 'utf8');
    return flags.length;
  };

  Object.defineProperty(flag, 'count', { get: () => flags.length });

  return flag;
}
