#!/usr/bin/env node
/**
 * Bundles playground/src into one self-contained playground/index.html
 * (no external requests), ready for GitHub Pages or any static host.
 *
 *   npm run build:playground
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['playground/src/main.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  write: false,
  legalComments: 'none',
});
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = readFileSync('playground/src/index.html', 'utf8');
if (!template.includes('/*__PLAYGROUND__*/')) throw new Error('placeholder missing in playground/src/index.html');
const html = template.replace('/*__PLAYGROUND__*/', () => script);
writeFileSync('playground/index.html', html);
console.log(`playground/index.html: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB`);
