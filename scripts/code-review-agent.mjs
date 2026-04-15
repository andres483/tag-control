#!/usr/bin/env node
/**
 * Code Review Agent
 *
 * Verifica la calidad del código antes de commitear:
 *   1. Drift entre frontend/ y app/ (shared files)
 *   2. Patrones inseguros: .catch() vacíos, .then() sin .catch()
 *   3. Queries Supabase sin .limit()
 *   4. console.log de producción olvidados
 *   5. Keys o tokens hardcodeados
 *
 * Uso:
 *   node scripts/code-review-agent.mjs              # revisa todo el proyecto
 *   node scripts/code-review-agent.mjs --staged     # solo archivos en git staging
 *   node scripts/code-review-agent.mjs --strict     # exit 1 si hay issues (para pre-commit hook)
 *
 * Como pre-commit hook (.git/hooks/pre-commit):
 *   #!/bin/sh
 *   node scripts/code-review-agent.mjs --staged --strict
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve, relative, extname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const staged  = process.argv.includes('--staged');
const strict  = process.argv.includes('--strict');

// ── Shared files drift check ──────────────────────────────────────────────────
const SHARED_FILES = ['tolls.json', 'geoUtils.js', 'pricing.js', 'inference.js', 'format.js'];
const FE_BASE  = resolve(ROOT, 'frontend/src');
const APP_BASE = resolve(ROOT, 'app/src');

function sharedPaths(name) {
  // tolls.json lives in data/, rest in lib/
  const sub = name.endsWith('.json') ? 'data' : 'lib';
  return {
    fe:  resolve(FE_BASE,  sub, name),
    app: resolve(APP_BASE, sub, name),
  };
}

const driftFindings = [];
for (const name of SHARED_FILES) {
  const { fe, app } = sharedPaths(name);
  if (!existsSync(fe) || !existsSync(app)) {
    driftFindings.push({ file: name, msg: `Missing in ${!existsSync(fe) ? 'frontend/' : 'app/'}` });
    continue;
  }
  const feContent  = readFileSync(fe,  'utf8');
  const appContent = readFileSync(app, 'utf8');
  if (feContent !== appContent) {
    driftFindings.push({ file: name, msg: 'Differs between frontend/ and app/ — run: node scripts/check-shared-drift.mjs --fix' });
  }
}

// ── Get files to analyze ──────────────────────────────────────────────────────
function getStagedFiles() {
  try {
    return execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8', cwd: ROOT })
      .trim().split('\n').filter(f => f && (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.mjs') || f.endsWith('.ts') || f.endsWith('.tsx')));
  } catch {
    return [];
  }
}

function getAllSourceFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.expo') continue;
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      getAllSourceFiles(full, files);
    } else {
      const ext = extname(entry);
      if (['.js', '.jsx', '.mjs', '.ts', '.tsx'].includes(ext)) {
        files.push(relative(ROOT, full));
      }
    }
  }
  return files;
}

const filePaths = staged ? getStagedFiles() : getAllSourceFiles(ROOT);

// ── Pattern checks ────────────────────────────────────────────────────────────
const PATTERNS = [
  {
    id: 'empty-catch',
    severity: 'warning',
    regex: /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g,
    msg: 'Empty .catch() swallows errors silently',
  },
  {
    id: 'then-no-catch',
    severity: 'warning',
    // .then(...) not followed by .catch — look for .then( that doesn't have .catch on same/next logical line
    // Simple heuristic: .then( at end of line without .catch on same line
    regex: /\.then\([^)]*\)[^.\n]*\n(?!\s*\.catch)/g,
    msg: '.then() without .catch() — unhandled rejection risk',
    skipInTest: true,
  },
  {
    id: 'supabase-no-limit',
    severity: 'error',
    // .from('x').select( without .limit( somewhere before the semicolon/await
    regex: /\.from\(['"`]\w+['"`]\)\.select\([^;{]*\)(?![\s\S]{0,200}\.limit\()/g,
    msg: 'Supabase query without .limit() — could return unbounded rows',
    fileFilter: f => !f.includes('scripts/') && !f.includes('gps-calibration'),
  },
  {
    id: 'hardcoded-key',
    severity: 'error',
    regex: /(?:service_role|SERVICE_ROLE|eyJ[A-Za-z0-9_-]{100,})[^'"\n]{0,5}/g,
    msg: 'Possible hardcoded service_role key or JWT',
    fileFilter: f => !f.includes('scripts/') && !f.includes('CLAUDE'),
  },
  {
    id: 'console-log',
    severity: 'info',
    regex: /console\.log\(/g,
    msg: 'console.log() left in production code',
    fileFilter: f => f.startsWith('frontend/src/') || f.startsWith('app/src/'),
  },
];

const codeFindings = [];

for (const filePath of filePaths) {
  const full = resolve(ROOT, filePath);
  if (!existsSync(full)) continue;

  let content;
  try { content = readFileSync(full, 'utf8'); } catch { continue; }

  for (const pattern of PATTERNS) {
    if (pattern.fileFilter && !pattern.fileFilter(filePath)) continue;

    const matches = [...content.matchAll(pattern.regex)];
    if (!matches.length) continue;

    // Find line numbers
    const lines = content.split('\n');
    for (const match of matches.slice(0, 5)) { // cap at 5 per file per pattern
      const matchIdx = match.index;
      let lineNo = 1, acc = 0;
      for (const line of lines) {
        acc += line.length + 1;
        if (acc > matchIdx) break;
        lineNo++;
      }
      codeFindings.push({
        severity: pattern.severity,
        file: filePath,
        line: lineNo,
        msg: pattern.msg,
        id: pattern.id,
      });
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
const ICON = { error: '✖', warning: '⚠', info: 'ℹ' };

console.log(`\nCode Review Agent${staged ? ' (staged files)' : ''} — ${new Date().toLocaleString('es-CL')}\n`);
console.log('─'.repeat(80));

let errors = 0, warnings = 0, infos = 0;

// Drift
if (driftFindings.length) {
  console.log('\n📂 Shared file drift:');
  for (const f of driftFindings) {
    console.log(`  ✖ ${f.file}  —  ${f.msg}`);
    errors++;
  }
}

// Code patterns
if (codeFindings.length) {
  const grouped = {};
  for (const f of codeFindings) {
    const key = f.file;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  }

  console.log('\n🔍 Code issues:');
  for (const [file, findings] of Object.entries(grouped)) {
    console.log(`\n  ${file}`);
    for (const f of findings) {
      console.log(`    ${ICON[f.severity]} L${f.line}  ${f.msg}`);
      if (f.severity === 'error') errors++;
      else if (f.severity === 'warning') warnings++;
      else infos++;
    }
  }
}

console.log('\n' + '─'.repeat(80));

if (errors + warnings + infos === 0) {
  console.log('\n✅ Todo ok — sin issues detectados\n');
} else {
  const parts = [];
  if (errors)   parts.push(`${errors} error${errors > 1 ? 'es' : ''}`);
  if (warnings) parts.push(`${warnings} advertencia${warnings > 1 ? 's' : ''}`);
  if (infos)    parts.push(`${infos} info`);
  console.log(`\n${parts.join(' · ')}\n`);
}

if (strict && errors > 0) {
  console.error('🚫 Commit bloqueado por errores críticos. Corrígelos y vuelve a intentar.\n');
  process.exit(1);
}
