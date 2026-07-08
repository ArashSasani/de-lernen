import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = new URL('../../', import.meta.url).pathname;
const CACHE_DIR = join(ROOT, 'data/sources/_text');

/**
 * Extract text from a PDF using pdftotext -layout.
 * Caches the result in data/sources/_text/.
 * @param {string} pdfPath  absolute path to the PDF
 * @param {{ from?: number, to?: number }} [opts]
 * @returns {string}
 */
export function extractText(pdfPath, { from, to } = {}) {
  const base = basename(pdfPath, '.pdf');
  const suffix = [from && `f${from}`, to && `l${to}`].filter(Boolean).join('-');
  const key = suffix ? `${base}-${suffix}` : base;
  const cachePath = join(CACHE_DIR, `${key}.txt`);

  if (existsSync(cachePath)) {
    return readFileSync(cachePath, 'utf8');
  }

  const args = ['-layout'];
  if (from != null) args.push('-f', String(from));
  if (to != null) args.push('-l', String(to));
  args.push(pdfPath, '-');

  const result = spawnSync('pdftotext', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`pdftotext exited ${result.status}: ${result.stderr}`);

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, result.stdout, 'utf8');
  return result.stdout;
}
