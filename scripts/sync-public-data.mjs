#!/usr/bin/env node
// Publishes the three large corpora from data/ (the tracked source of truth) to
// public/data/ (gitignored) for runtime fetch — wired into predev/prebuild. ADR 013.

import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// grammar.json stays a bundled import: api/ai reads it server-side on the Edge.
export const PUBLISHED = [
  'words.json',
  'daily-texts.json',
  'grammar-bank.json',
];

async function main() {
  const dest = join(ROOT, 'public', 'data');
  await mkdir(dest, { recursive: true });

  for (const name of PUBLISHED) {
    const from = join(ROOT, 'data', name);
    try {
      await stat(from);
    } catch {
      console.error(
        `sync-public-data: missing data/${name} — run the build scripts first`,
      );
      process.exit(1);
    }
    await copyFile(from, join(dest, name));
  }

  console.log(`sync-public-data: published ${PUBLISHED.length} files`);
}

main().catch((err) => {
  console.error('sync-public-data failed:', err);
  process.exit(1);
});
