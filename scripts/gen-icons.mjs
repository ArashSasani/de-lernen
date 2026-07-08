#!/usr/bin/env node
// One-off: generates public/icons/icon-{192,512}.png and public/apple-touch-icon.png
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

await mkdir(join(root, 'public/icons'), { recursive: true });

// Simple dark-background icon: navy square with "de" text rendered via SVG
function makeSvg(size) {
  const pad = Math.round(size * 0.1);
  const fontSize = Math.round(size * 0.38);
  const subSize = Math.round(size * 0.18);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#0C0F1A"/>
  <text x="${size / 2}" y="${size * 0.52}" font-family="Georgia, serif" font-size="${fontSize}"
    font-weight="bold" fill="#A8D8EA" text-anchor="middle" dominant-baseline="middle">de</text>
  <text x="${size / 2}" y="${size * 0.78}" font-family="Georgia, serif" font-size="${subSize}"
    fill="#5B7FA6" text-anchor="middle">lernen</text>
</svg>`);
}

for (const size of [192, 512]) {
  await sharp(makeSvg(size))
    .png()
    .toFile(join(root, `public/icons/icon-${size}.png`));
  console.log(`icon-${size}.png done`);
}

// apple-touch-icon: 180x180
await sharp(makeSvg(180))
  .png()
  .toFile(join(root, 'public/apple-touch-icon.png'));
console.log('apple-touch-icon.png done');
