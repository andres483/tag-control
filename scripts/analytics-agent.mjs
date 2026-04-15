#!/usr/bin/env node
/**
 * Analytics Agent
 *
 * Genera resumen diario de actividad: usuarios activos, viajes, CLP total,
 * anomalías de detección, tendencias. Pensado para correr a las 08:00 Santiago.
 *
 * Uso:
 *   node scripts/analytics-agent.mjs              # último día (default)
 *   node scripts/analytics-agent.mjs --days=7     # última semana
 *   node scripts/analytics-agent.mjs --days=30    # último mes
 *   node scripts/analytics-agent.mjs --format=whatsapp   # mensaje listo para pegar
 *
 * Output:
 *   - Consola (siempre)
 *   - WhatsApp-ready message con --format=whatsapp
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://nttnryildsxllxqfkkvz.supabase.co';
const ANON = 'sb_publishable_q2xnR7c4SU4DJTNkoc0Dgw_K6-Vfvrr';

const daysArg   = process.argv.find(a => a.startsWith('--days='));
const DAYS      = daysArg ? parseInt(daysArg.split('=')[1]) : 1;
const formatArg = process.argv.find(a => a.startsWith('--format='));
const FORMAT    = formatArg ? formatArg.split('=')[1] : 'console';

// ── Supabase helper ───────────────────────────────────────────────────────────
async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// ── Format helpers ────────────────────────────────────────────────────────────
function formatCLP(n) {
  return `$${Math.round(n).toLocaleString('es-CL')}`;
}

function pct(num, den) {
  if (!den) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

function pad(label, value, width = 32) {
  return `${label.padEnd(width)}${value}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
const label  = DAYS === 1 ? 'ayer' : `últimos ${DAYS} días`;

console.log(`\nAnalytics Agent — ${label} (desde ${cutoff.slice(0, 10)})\n`);

// 1. Viajes completados
const trips = await sb(`trips?select=id,driver,toll_count,total_cost,start_time,platform&created_at=gte.${cutoff}&order=created_at.desc&limit=1000`);

// 2. Viajes activos ahora (live_trips sin end_time)
const liveTrips = await sb(`live_trips?select=id,driver,created_at&is_active=eq.true&order=created_at.desc&limit=100`);

// 3. Usuarios únicos del período
const driversRaw = new Set((trips ?? []).map(t => t.driver).filter(Boolean));
const drivers = [...driversRaw].sort();

// 4. CLP stats
const totalCLP   = (trips ?? []).reduce((s, t) => s + (t.total_cost || 0), 0);
const totalTolls = (trips ?? []).reduce((s, t) => s + (t.toll_count || 0), 0);
const tripsCount = trips?.length ?? 0;
const zeroTolls  = (trips ?? []).filter(t => (t.toll_count || 0) === 0).length;

// 5. Per-driver stats
const byDriver = {};
for (const t of (trips ?? [])) {
  const d = t.driver || 'desconocido';
  if (!byDriver[d]) byDriver[d] = { trips: 0, tolls: 0, clp: 0, zeros: 0 };
  byDriver[d].trips++;
  byDriver[d].tolls += t.toll_count || 0;
  byDriver[d].clp   += t.total_cost || 0;
  if ((t.toll_count || 0) === 0) byDriver[d].zeros++;
}

// 6. Platform breakdown
const byPlatform = {};
for (const t of (trips ?? [])) {
  const p = t.platform || 'unknown';
  byPlatform[p] = (byPlatform[p] || 0) + 1;
}

// 7. Anomalies: users with >50% zero-toll trips
const anomalies = Object.entries(byDriver).filter(([, s]) => s.trips >= 2 && s.zeros / s.trips > 0.5);

// 8. Top toll hour distribution (if more than 1 day)
let hourDist = null;
if (DAYS > 1 && trips?.length) {
  const hours = trips.map(t => new Date(t.start_time).getHours());
  const dist = new Array(24).fill(0);
  for (const h of hours) dist[h]++;
  const peak = dist.indexOf(Math.max(...dist));
  hourDist = { dist, peak };
}

// ── Console output ────────────────────────────────────────────────────────────
console.log('═'.repeat(60));
console.log(`  RESUMEN ${label.toUpperCase()}  ·  TAGcontrol`);
console.log('═'.repeat(60));

console.log('\n📊 GENERAL');
console.log('─'.repeat(60));
console.log(pad('Viajes completados:', tripsCount));
console.log(pad('Peajes detectados:', totalTolls));
console.log(pad('CLP cobrado total:', formatCLP(totalCLP)));
console.log(pad('Promedio peajes/viaje:', tripsCount ? (totalTolls / tripsCount).toFixed(1) : '—'));
console.log(pad('Promedio CLP/viaje:', tripsCount ? formatCLP(totalCLP / tripsCount) : '—'));

if (liveTrips?.length) {
  console.log(pad('Viajes activos ahora:', liveTrips.length));
}

if (Object.keys(byPlatform).length > 1) {
  const parts = Object.entries(byPlatform).map(([p, n]) => `${p}: ${n}`).join(' · ');
  console.log(pad('Plataformas:', parts));
}

console.log('\n👥 POR USUARIO');
console.log('─'.repeat(60));
for (const [driver, s] of Object.entries(byDriver).sort((a, b) => b[1].clp - a[1].clp)) {
  const failRate = s.zeros ? ` (${pct(s.zeros, s.trips)} sin peajes)` : '';
  console.log(pad(`  ${driver}:`, `${s.trips} viajes · ${s.tolls} peajes · ${formatCLP(s.clp)}${failRate}`));
}

if (zeroTolls > 0) {
  console.log('\n⚠  ANOMALÍAS');
  console.log('─'.repeat(60));
  console.log(pad('Viajes sin peajes:', `${zeroTolls} de ${tripsCount} (${pct(zeroTolls, tripsCount)})`));
  for (const [driver, s] of anomalies) {
    console.log(`  ⚠ ${driver}: ${s.zeros}/${s.trips} viajes fallidos — posible problema de detección`);
  }
}

if (hourDist) {
  console.log('\n🕐 HORA PUNTA');
  console.log('─'.repeat(60));
  console.log(pad('Pico de viajes:', `${hourDist.peak}:00h`));
}

console.log('\n' + '═'.repeat(60) + '\n');

// ── WhatsApp format ───────────────────────────────────────────────────────────
if (FORMAT === 'whatsapp') {
  const dateLabel = DAYS === 1
    ? new Date(Date.now() - 86400000).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
    : `${cutoff.slice(0, 10)} → ${new Date().toISOString().slice(0, 10)}`;

  const driverLines = Object.entries(byDriver)
    .sort((a, b) => b[1].clp - a[1].clp)
    .map(([d, s]) => `  • ${d}: ${s.trips} viaje${s.trips > 1 ? 's' : ''} · ${formatCLP(s.clp)}`)
    .join('\n');

  const anomalyLines = anomalies.length
    ? `\n⚠️ *Alerta detección:*\n${anomalies.map(([d, s]) => `  • ${d}: ${s.zeros}/${s.trips} sin peajes`).join('\n')}`
    : '';

  const msg = `
📊 *TAGcontrol — ${dateLabel}*

🚗 ${tripsCount} viaje${tripsCount !== 1 ? 's' : ''} · ${totalTolls} peaje${totalTolls !== 1 ? 's' : ''} detectados
💰 Total cobrado: *${formatCLP(totalCLP)}*

*Por usuario:*
${driverLines}${anomalyLines}

_Generado automáticamente — 08:00 Santiago_
`.trim();

  console.log('─'.repeat(60));
  console.log('MENSAJE WHATSAPP:');
  console.log('─'.repeat(60));
  console.log(msg);
  console.log('─'.repeat(60) + '\n');
}
