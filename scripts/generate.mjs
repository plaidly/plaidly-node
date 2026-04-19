#!/usr/bin/env node
// Generate TypeScript types from the Plaidly OpenAPI 3.1 spec.
//
// Source: by default reads spec/openapi.yaml (committed copy).
// Override with OPENAPI_URL (http(s) URL or filesystem path).
//
// Output: src/generated/schema.ts  (openapi-typescript)
//
// Regenerate with:   npm run generate

import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const source = process.env.OPENAPI_URL || resolve(repoRoot, 'spec/openapi.yaml');
const outDir = resolve(repoRoot, 'src/generated');
const outFile = resolve(outDir, 'schema.ts');

if (!outDir || !existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

if (!source.startsWith('http') && !existsSync(source)) {
  console.error(`OpenAPI spec not found at ${source}`);
  process.exit(1);
}

console.log(`Generating types from ${source} -> ${outFile}`);
execFileSync(
  'npx',
  ['--yes', 'openapi-typescript@7.6.1', source, '--output', outFile],
  { stdio: 'inherit', cwd: repoRoot },
);
console.log('Done.');
