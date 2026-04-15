#!/usr/bin/env node
// Ensure the "identical by contract" files between frontend/ (PWA) and app/
// (React Native) stay in sync. Run in CI / pre-commit — exits non-zero on
// drift and prints a unified diff.
//
// Usage:
//   node scripts/check-shared-drift.mjs           # check only
//   node scripts/check-shared-drift.mjs --fix     # copy frontend → app
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Canonical source = frontend/. app/ must mirror it.
const SHARED = [
  'src/data/tolls.json',
  'src/lib/geoUtils.js',
  'src/lib/pricing.js',
  'src/lib/inference.js',
  'src/lib/format.js',
];

const fix = process.argv.includes('--fix');
let drift = false;

for (const rel of SHARED) {
  const fePath = resolve(ROOT, 'frontend', rel);
  const appPath = resolve(ROOT, 'app', rel);
  let fe, app;
  try { fe = readFileSync(fePath, 'utf8'); } catch { console.log(`SKIP ${rel} (missing in frontend)`); continue; }
  try { app = readFileSync(appPath, 'utf8'); } catch { console.log(`MISSING in app: ${rel}`); drift = true; continue; }

  if (fe === app) continue;
  drift = true;
  if (fix) {
    writeFileSync(appPath, fe);
    console.log(`FIXED ${rel} (copied frontend → app)`);
  } else {
    console.log(`\nDRIFT in ${rel}:`);
    try {
      execSync(`diff -u "${fePath}" "${appPath}"`, { stdio: 'inherit' });
    } catch { /* diff exits 1 when files differ, ignore */ }
  }
}

if (drift && !fix) {
  console.log('\n✗ Shared files drifted. Run with --fix to sync frontend → app.');
  process.exit(1);
}
console.log(drift ? '\n✓ Drift fixed.' : '✓ All shared files in sync.');
