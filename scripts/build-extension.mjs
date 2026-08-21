/**
 * Bundles lib/ai + WebLLM into a single ESM file the extension can load.
 *
 * MV3 blocks remote code, so everything must ship inside the extension
 * directory. Run after changing anything under lib/ai/.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

const OUT = 'LectureNoteTaker/vendor/bevo-ai.js';
mkdirSync('LectureNoteTaker/vendor', { recursive: true });

const result = await build({
  entryPoints: ['lib/ai/extension-entry.ts'],
  outfile: OUT,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  // WebGPU in extension service workers requires Chrome 124+, so there is no
  // reason to down-level below it.
  target: 'chrome124',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`built ${OUT} — ${(bytes / 1024).toFixed(0)} KB`);
