#!/usr/bin/env node
/**
 * CTO Review — Session check-in automático para TAGcontrol.
 *
 * Lee el historial de commits desde el último audit y decide qué investigar.
 * El objetivo es que este script haga las preguntas correctas sin que el
 * usuario tenga que pedirlas.
 *
 * Uso:
 *   node scripts/cto-review.mjs           # auto: decide según commits
 *   node scripts/cto-review.mjs --full    # fuerza audit completo (5 roles)
 *   node scripts/cto-review.mjs --quick   # solo git status, sin llamadas API
 *   node scripts/cto-review.mjs --mark    # marca HEAD como auditado (post-fix manual)
 *
 * Umbrales:
 *   0-3 commits: solo drift check, sin API
 *   4-9 commits: audit enfocado (tech si hay código de detección, ux si hay UI)
 *   10+ commits: audit completo (todos los roles)
 *   --full: fuerza completo sin importar el count
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { sendMessage, agentBlock, isConfigured as slackReady } from './lib/slack.mjs';

const STATE_PATH = new URL('.cto-state.json', import.meta.url).pathname;

// Archivos cuyo cambio amerita audit técnico
const DETECTION_FILES = ['locationService', 'useGPS', 'inference', 'geoUtils', 'tolls.json', 'reconstruction', 'useTrip'];
const UI_FILES        = ['.jsx', '.tsx', 'pages/', 'components/'];
const BACKEND_FILES   = ['liveTracking', 'supabase', 'auth', 'pricing'];

// ── State ──────────────────────────────────────────────────────────────────────

function readState() {
  if (!existsSync(STATE_PATH)) {
    return { lastAuditCommit: null, lastAuditDate: null, openIssues: [] };
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
}

function writeState(patch) {
  const current = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf8')) : {};
  writeFileSync(STATE_PATH, JSON.stringify({ ...current, ...patch, updatedAt: new Date().toISOString() }, null, 2));
}

// ── Git helpers ────────────────────────────────────────────────────────────────

function getCommits(since) {
  try {
    const range = since ? `${since}..HEAD` : '--max-count=20';
    const out = execSync(`git log --oneline ${range} 2>/dev/null`).toString().trim();
    return out ? out.split('\n') : [];
  } catch { return []; }
}

function getChangedFiles(commits) {
  const files = new Set();
  for (const commit of commits) {
    const sha = commit.split(' ')[0];
    try {
      execSync(`git diff-tree --no-commit-id -r --name-only ${sha}`)
        .toString().split('\n').filter(Boolean).forEach(f => files.add(f));
    } catch {}
  }
  return [...files];
}

function categorize(files) {
  return {
    detection: files.some(f => DETECTION_FILES.some(p => f.includes(p))),
    ui:        files.some(f => UI_FILES.some(p => f.includes(p))),
    backend:   files.some(f => BACKEND_FILES.some(p => f.includes(p))),
  };
}

// ── Roles ──────────────────────────────────────────────────────────────────────

const ROLES = {
  tech: {
    emoji: '⚙️',
    name: 'Senior Engineer',
    focus: 'GPS detection pipeline, edge cases, regressions, seguridad, deuda técnica',
    questions: [
      '¿Qué bug crítico introdujeron los últimos cambios que todavía no se ve en producción?',
      '¿Qué caso borde de GPS, timing, o concesionaria no está cubierto?',
      '¿Qué anti-pattern de arquitectura podría causar problemas al escalar a 1000 usuarios?',
    ],
  },
  ux: {
    emoji: '🎨',
    name: 'UX / Conductor no-técnico',
    focus: 'usabilidad móvil, onboarding, notificaciones, flujo para conductores chilenos',
    questions: [
      '¿Qué punto del flujo haría que un conductor chileno no-técnico abandone la app?',
      '¿Qué notificación o feedback falta para que el conductor confíe en la detección?',
      '¿Cómo simplificarías "iniciar viaje" al mínimo absoluto posible?',
    ],
  },
  product: {
    emoji: '📋',
    name: 'Product Manager',
    focus: 'retención, viral loops, métricas que importan ahora',
    questions: [
      '¿Cuál es el único metric en que deberían obsesionarse en los próximos 7 días?',
      '¿Qué feature ausente causaría churn en semana 2?',
      '¿Qué hipótesis de producto validarías en las próximas 48 horas con los 21 usuarios actuales?',
    ],
  },
  growth: {
    emoji: '🚀',
    name: 'Growth Lead Chile',
    focus: 'adquisición $0, viralidad WhatsApp, Chile específicamente',
    questions: [
      '¿Qué mecanismo viral falta para que un usuario convenza a otro conductor en Chile?',
      '¿Cuál es el momento "atrapé un error de cobro" y cómo lo amplificarías?',
      '¿Qué canal de adquisición atacarías primero con $0?',
    ],
  },
  ceo: {
    emoji: '👔',
    name: 'CEO / Investor',
    focus: 'riesgo de negocio, competencia RutaTag, defensibilidad',
    questions: [
      '¿Cuál es el mayor riesgo de negocio en los próximos 30 días?',
      '¿Por qué RutaTag podría ganar si no se mueven esta semana?',
      '¿La pregunta más incómoda que le harías al equipo hoy?',
    ],
  },
};

// ── Audit runner ───────────────────────────────────────────────────────────────

async function runAudit(roleKeys, context) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results = await Promise.all(roleKeys.map(async key => {
    const role = ROLES[key];
    const qs = role.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    const r = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 450,
      system: `Eres un ${role.name} con experiencia en apps de movilidad y fintech en Chile.
Tu foco: ${role.focus}.
Eres directo, crítico, sin halagos. Identificas problemas reales con acciones concretas.
El equipo tiene 48 horas para mejorar el producto.`,
      messages: [{
        role: 'user',
        content: `${context}\n\n---\nResponde estas 3 preguntas desde tu rol. Máximo 3 líneas por respuesta. Sin intro:\n\n${qs}`,
      }],
    });
    return { key, ...role, findings: r.content[0].text };
  }));
  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args   = process.argv.slice(2);
  const full   = args.includes('--full');
  const quick  = args.includes('--quick');
  const mark   = args.includes('--mark');

  // --mark: registrar HEAD como auditado (para usar después de un fix manual)
  if (mark) {
    const head = execSync('git rev-parse HEAD').toString().trim();
    writeState({ lastAuditCommit: head, lastAuditDate: new Date().toISOString() });
    console.log(`✓ HEAD ${head.slice(0, 7)} marcado como auditado.\n`);
    return;
  }

  const state   = readState();
  const commits = getCommits(state.lastAuditCommit);
  const since   = state.lastAuditDate
    ? `desde ${new Date(state.lastAuditDate).toLocaleDateString('es-CL')}`
    : '(primera revisión)';

  console.log(`\n🔍  CTO Review · TAGcontrol · ${new Date().toLocaleString('es-CL')}`);
  console.log(`    ${commits.length} commit${commits.length !== 1 ? 's' : ''} ${since}\n`);

  if (commits.length > 0) {
    commits.slice(0, 10).forEach(c => console.log(`    ${c}`));
    if (commits.length > 10) console.log(`    ... +${commits.length - 10} más`);
    console.log('');
  }

  // Drift check siempre
  try {
    const drift = execSync('node scripts/check-shared-drift.mjs 2>&1').toString().trim();
    if (drift.includes('DRIFT')) {
      console.log('⚠️  DRIFT detectado — ejecutar: node scripts/check-shared-drift.mjs --fix\n');
    }
  } catch {}

  if (quick || (!full && commits.length < 4)) {
    if (commits.length < 4) console.log('    Menos de 4 commits — sin audit automático.\n');
    console.log('✓ Check rápido completo.\n');
    return;
  }

  // Decidir roles
  const files   = getChangedFiles(commits);
  const cat     = categorize(files);
  let rolesToRun;

  if (full || commits.length >= 10) {
    rolesToRun = ['tech', 'ux', 'product', 'growth', 'ceo'];
  } else if (commits.length >= 4) {
    rolesToRun = ['tech'];
    if (cat.ui)      rolesToRun.push('ux');
    if (cat.backend) rolesToRun.push('product');
  }

  const areas = [cat.detection && 'detección GPS', cat.ui && 'UI', cat.backend && 'backend'].filter(Boolean);
  console.log(`    Áreas cambiadas: ${areas.join(', ') || 'misc'}`);
  console.log(`    Roles: ${rolesToRun.join(', ')}\n`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  ANTHROPIC_API_KEY no configurado — saltando audit.\n');
    console.log('   Exporta la variable y vuelve a correr para el audit completo.\n');
    return;
  }

  const CLAUDE_MD  = existsSync('./CLAUDE.md')  ? readFileSync('./CLAUDE.md', 'utf8')  : '';
  const ROADMAP_MD = existsSync('./ROADMAP.md') ? readFileSync('./ROADMAP.md', 'utf8') : '';
  const gitLog     = execSync('git log --oneline -10').toString().trim();
  const context = `# TAGcontrol — Contexto\n\n${CLAUDE_MD}\n\n## Roadmap\n${ROADMAP_MD}\n\n## Últimos commits\n${gitLog}`;

  const results = await runAudit(rolesToRun, context);

  for (const r of results) {
    console.log('─'.repeat(52));
    console.log(`${r.emoji}  ${r.name.toUpperCase()}`);
    console.log('─'.repeat(52));
    console.log(r.findings);
    console.log('');
  }

  // Guardar estado
  const head = execSync('git rev-parse HEAD').toString().trim();
  writeState({ lastAuditCommit: head, lastAuditDate: new Date().toISOString(), lastRoles: rolesToRun });

  // Slack (opcional)
  if (slackReady()) {
    const body = results.map(r =>
      `${r.emoji} *${r.name}*\n${r.findings.split('\n').slice(0, 5).join('\n')}`
    ).join('\n\n---\n\n');
    await sendMessage(agentBlock(
      `CTO Review · ${new Date().toLocaleDateString('es-CL')} · ${rolesToRun.join('+')}`,
      body
    )).catch(() => {});
    console.log('✓ Enviado a Slack #tagcontrol-ops');
  }

  console.log(`✓ Estado guardado. Próxima revisión cuando llegues a ~4 commits nuevos.\n`);
  console.log('   Para marcar como revisado sin audit: node scripts/cto-review.mjs --mark\n');
}

main().catch(err => { console.error(err.message); process.exit(1); });
