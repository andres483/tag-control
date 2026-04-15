#!/usr/bin/env node
/**
 * Release Agent
 *
 * Triggered on merge to main. Runs EAS Build (Android preview APK),
 * waits for completion, and distributes the download link.
 *
 * Uso:
 *   node scripts/release-agent.mjs                  # build Android + espera resultado
 *   node scripts/release-agent.mjs --platform ios   # build iOS (requiere Apple Dev)
 *   node scripts/release-agent.mjs --no-wait        # lanza build y sale (no espera)
 *   node scripts/release-agent.mjs --dry-run        # muestra plan, no construye
 *
 * Como GitHub Action (en .github/workflows/release.yml):
 *   - uses: actions/checkout@v4
 *   - run: node scripts/release-agent.mjs
 */

import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APP_DIR = resolve(ROOT, 'app');

const platform  = process.argv.find(a => a.startsWith('--platform='))?.split('=')[1] ?? 'android';
const noWait    = process.argv.includes('--no-wait');
const dryRun    = process.argv.includes('--dry-run');

const PROFILE = platform === 'ios' ? 'preview' : 'preview';
const POLL_INTERVAL_MS = 30_000; // 30s between status checks
const MAX_WAIT_MIN = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: APP_DIR, ...opts }).trim();
}

function tryRun(cmd, opts = {}) {
  try { return run(cmd, opts); } catch (e) { return null; }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Pre-flight ────────────────────────────────────────────────────────────────
console.log(`\nRelease Agent — ${platform.toUpperCase()} · ${new Date().toLocaleString('es-CL')}\n`);

// Check EAS CLI
const easVersion = tryRun('npx eas-cli --version');
if (!easVersion) {
  console.error('✖ eas-cli no encontrado. Instala con: npm install -g eas-cli');
  process.exit(1);
}
console.log(`EAS CLI: ${easVersion}`);

// Get current commit info
const commit = tryRun('git rev-parse --short HEAD', { cwd: ROOT }) ?? 'unknown';
const branch = tryRun('git branch --show-current', { cwd: ROOT }) ?? 'unknown';
const message = tryRun('git log -1 --format=%s', { cwd: ROOT }) ?? '';

console.log(`Branch: ${branch}  Commit: ${commit}`);
console.log(`Message: ${message}\n`);

if (dryRun) {
  console.log('─'.repeat(80));
  console.log(`DRY RUN — se ejecutaría:`);
  console.log(`  cd app && npx eas-cli build --platform ${platform} --profile ${PROFILE} --non-interactive`);
  console.log(`  Espera hasta ${MAX_WAIT_MIN} min para completar`);
  console.log(`  Extrae URL del APK/IPA`);
  console.log('─'.repeat(80));
  console.log('\nCorre sin --dry-run para construir de verdad.\n');
  process.exit(0);
}

// ── Launch build ──────────────────────────────────────────────────────────────
console.log(`Lanzando EAS Build (${platform} · ${PROFILE})...\n`);

let buildId;
try {
  const output = run(`npx eas-cli build --platform ${platform} --profile ${PROFILE} --non-interactive --json`, { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const parsed = JSON.parse(output);
    buildId = Array.isArray(parsed) ? parsed[0]?.id : parsed?.id;
  } catch {
    // fallback: extract UUID from output
    const match = output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    buildId = match?.[0];
  }
} catch (e) {
  // eas-cli exits non-zero on some versions even when successful
  const match = e.stdout?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  buildId = match?.[0];
  if (!buildId) {
    console.error('✖ Error lanzando build:', e.message);
    process.exit(1);
  }
}

if (buildId) {
  console.log(`✓ Build iniciado: ${buildId}`);
  console.log(`  https://expo.dev/accounts/andrespanthervillagran/projects/tagcontrol/builds/${buildId}\n`);
} else {
  console.log('✓ Build iniciado (ID no capturado — revisa expo.dev)\n');
}

if (noWait) {
  console.log('--no-wait activo: saliendo sin esperar resultado.\n');
  process.exit(0);
}

// ── Wait for completion ───────────────────────────────────────────────────────
if (!buildId) {
  console.log('Sin buildId, no se puede monitorear. Revisa expo.dev manualmente.\n');
  process.exit(0);
}

console.log(`Esperando resultado (máx ${MAX_WAIT_MIN} min, polling cada ${POLL_INTERVAL_MS / 1000}s)...\n`);

const deadline = Date.now() + MAX_WAIT_MIN * 60 * 1000;
let artifactUrl = null;
let finalStatus = null;

while (Date.now() < deadline) {
  await sleep(POLL_INTERVAL_MS);

  let statusOutput;
  try {
    statusOutput = run(`npx eas-cli build:view ${buildId} --json`);
  } catch {
    statusOutput = tryRun(`npx eas-cli build:view ${buildId}`);
    if (!statusOutput) { process.stdout.write('.'); continue; }
  }

  let status, url;
  try {
    const parsed = JSON.parse(statusOutput);
    status = parsed.status;
    url = parsed.artifacts?.buildUrl ?? parsed.artifacts?.url;
  } catch {
    // text output fallback
    const statusMatch = statusOutput.match(/status[:\s]+(\w+)/i);
    status = statusMatch?.[1]?.toLowerCase();
    const urlMatch = statusOutput.match(/https:\/\/expo\.dev\/artifacts\/[^\s]+/);
    url = urlMatch?.[0];
  }

  const elapsed = Math.round((Date.now() - (deadline - MAX_WAIT_MIN * 60 * 1000)) / 60000);
  process.stdout.write(`\r  ${elapsed}min — estado: ${status ?? '?'}          `);

  if (status === 'finished' || status === 'errored' || status === 'cancelled') {
    finalStatus = status;
    artifactUrl = url;
    break;
  }
}

console.log('');

// ── Result ────────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(80));

if (finalStatus === 'finished' && artifactUrl) {
  console.log(`\n✅ BUILD EXITOSO\n`);
  console.log(`   Plataforma: ${platform}`);
  console.log(`   Commit: ${commit} (${branch})`);
  console.log(`   Descarga: ${artifactUrl}\n`);

  // Print WhatsApp-ready message
  const date = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  console.log('─'.repeat(80));
  console.log('Mensaje para el grupo (copia esto):');
  console.log('─'.repeat(80));
  console.log(`
📲 *TAGcontrol v nueva — ${date}*

Nueva versión disponible para Android.

🔗 ${artifactUrl}

_${message}_
`);

} else if (finalStatus === 'errored') {
  console.error(`\n✖ BUILD FALLÓ\n`);
  console.error(`  Revisa: https://expo.dev/accounts/andrespanthervillagran/projects/tagcontrol/builds/${buildId}\n`);
  process.exit(1);
} else if (!finalStatus) {
  console.log(`\n⏳ TIMEOUT — build sigue corriendo`);
  console.log(`   Revisa: https://expo.dev/accounts/andrespanthervillagran/projects/tagcontrol/builds/${buildId}\n`);
} else {
  console.log(`\n⚠ Estado final: ${finalStatus}\n`);
}
