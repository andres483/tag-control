#!/usr/bin/env node
/**
 * GPS Calibration Agent
 *
 * Analiza posiciones GPS de viajes recientes y propone calibraciones para
 * tolls.json: coordenadas ajustadas y/o radio_deteccion_m optimizado.
 *
 * Cómo funciona:
 *   1. Lee todos los trips de los últimos N días con posiciones GPS disponibles
 *   2. Por cada peaje, calcula el foot-of-perpendicular sobre los segmentos GPS
 *   3. Agrega los resultados: mediana del foot, P90 del closest approach
 *   4. Si ≥ MIN_PASSES pasadas: propone nuevas coords y/o nuevo radio
 *
 * Uso:
 *   node scripts/gps-calibration-agent.mjs              # dry run, solo reporte
 *   node scripts/gps-calibration-agent.mjs --apply      # actualiza tolls.json
 *   node scripts/gps-calibration-agent.mjs --apply --pr # actualiza + crea PR en GitHub
 *   node scripts/gps-calibration-agent.mjs --days 7     # ampliar ventana de análisis (default: 3)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const TOLLS_FE  = resolve(ROOT, 'frontend/src/data/tolls.json');
const TOLLS_APP = resolve(ROOT, 'app/src/data/tolls.json');

const SUPABASE_URL = 'https://nttnryildsxllxqfkkvz.supabase.co';
const ANON = 'sb_publishable_q2xnR7c4SU4DJTNkoc0Dgw_K6-Vfvrr';

const apply   = process.argv.includes('--apply');
const createPR = process.argv.includes('--pr');
const daysArg = process.argv.find(a => a.startsWith('--days='));
const DAYS    = daysArg ? parseInt(daysArg.split('=')[1]) : 3;

const MIN_PASSES       = 3;    // min passes to propose a change
const MIN_COORD_SHIFT  = 15;   // meters — don't move coords for tiny shifts
const MAX_COORD_SHIFT  = 200;  // meters — shifts larger than this are likely GPS noise, skip
const RADIUS_MARGIN    = 1.35; // new_radius = P90_closest * RADIUS_MARGIN
const MIN_RADIUS       = 200;  // never go below this (at highway speed, 200m is tight)
const MAX_RADIUS       = 500;  // never go above this (use inference instead)

// ── Supabase helper ──────────────────────────────────────────────────────────
async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// ── Geometry ─────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function footOnSegment(A, B, P) {
  const toR  = d => d * Math.PI / 180;
  const latRef = toR((A.lat + B.lat) / 2);
  const sc   = 111320;
  const ax = A.lng * Math.cos(latRef) * sc, ay = A.lat * sc;
  const bx = B.lng * Math.cos(latRef) * sc, by = B.lat * sc;
  const px = P.lng * Math.cos(latRef) * sc, py = P.lat * sc;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx*dx + dy*dy;
  if (len2 < 1e-6) return { lat: A.lat, lng: A.lng, dist: haversine(A.lat, A.lng, P.lat, P.lng) };
  let t = ((px-ax)*dx + (py-ay)*dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const fx = ax + t*dx, fy = ay + t*dy;
  const flat = fy / sc;
  const flng = fx / (Math.cos(latRef) * sc);
  return { lat: flat, lng: flng, dist: haversine(flat, flng, P.lat, P.lng) };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function percentile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * p)];
}

function roundToNearest(val, step) {
  return Math.round(val / step) * step;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const tollsData = JSON.parse(readFileSync(TOLLS_FE, 'utf8'));
const TOLLS = tollsData.tolls;

const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
console.log(`\nGPS Calibration Agent — últimos ${DAYS} días (desde ${cutoff.slice(0, 10)})\n`);

// Trips recientes con posiciones
const trips = await sb(`trips?select=id,driver,start_time&created_at=gte.${cutoff}&order=created_at.desc&limit=200`);
if (!trips?.length) { console.log('Sin viajes recientes.'); process.exit(0); }
console.log(`${trips.length} viajes a analizar...\n`);

// Por peaje: acumular closest-approach y foot coords
const tollData = {};
for (const toll of TOLLS) {
  tollData[toll.id] = { toll, passes: [], closestApproaches: [], feet: [] };
}

let tripsWithPositions = 0;
for (const trip of trips) {
  const positions = await sb(`positions?select=lat,lng,speed,created_at&trip_id=eq.${encodeURIComponent(trip.id)}&order=created_at.asc&limit=2000`);
  if (!positions?.length || positions.length < 2) continue;
  tripsWithPositions++;

  for (const toll of TOLLS) {
    let best = { dist: Infinity, lat: null, lng: null };

    for (let i = 0; i < positions.length - 1; i++) {
      const A = { lat: positions[i].lat, lng: positions[i].lng };
      const B = { lat: positions[i+1].lat, lng: positions[i+1].lng };

      // Skip huge gaps (signal loss)
      if (haversine(A.lat, A.lng, B.lat, B.lng) > 2000) continue;

      const foot = footOnSegment(A, B, { lat: toll.lat, lng: toll.lng });
      if (foot.dist < best.dist) best = foot;
    }

    // Only count passes that came within 2× the detection radius
    const radius = toll.radio_deteccion_m || 300;
    if (best.dist < radius * 2) {
      tollData[toll.id].passes.push(trip.id);
      tollData[toll.id].closestApproaches.push(best.dist);
      tollData[toll.id].feet.push({ lat: best.lat, lng: best.lng });
    }
  }
}

console.log(`${tripsWithPositions} viajes con posiciones GPS\n`);
console.log('─'.repeat(80));

const proposals = [];

for (const toll of TOLLS) {
  const d = tollData[toll.id];
  if (d.passes.length === 0) continue;
  if (d.passes.length < MIN_PASSES) {
    console.log(`${toll.nombre.padEnd(35)} ${d.passes.length} pasada${d.passes.length > 1 ? 's' : ''} — necesita ≥${MIN_PASSES} para calibrar`);
    continue;
  }

  const p90        = percentile(d.closestApproaches, 0.9);
  const medFoot    = { lat: median(d.feet.map(f => f.lat)), lng: median(d.feet.map(f => f.lng)) };
  const coordShift = haversine(toll.lat, toll.lng, medFoot.lat, medFoot.lng);
  const newRadius  = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, roundToNearest(p90 * RADIUS_MARGIN, 25)));
  const currentRadius = toll.radio_deteccion_m || 300;

  // Shifts >MAX_COORD_SHIFT suggest GPS was far from the toll — likely noise
  if (coordShift > MAX_COORD_SHIFT) {
    console.log(`${toll.nombre.padEnd(35)} ${d.passes.length} pasadas ⚠  shift ${coordShift.toFixed(0)}m — demasiado grande, verificar manualmente`);
    continue;
  }

  const needsCoord  = coordShift > MIN_COORD_SHIFT;
  const needsRadius = Math.abs(newRadius - currentRadius) >= 25;

  if (!needsCoord && !needsRadius) {
    console.log(`${toll.nombre.padEnd(35)} ${d.passes.length} pasadas ✓ OK (radio ${currentRadius}m, shift ${coordShift.toFixed(0)}m)`);
    continue;
  }

  const changes = [];
  if (needsCoord)  changes.push(`coords (shift ${coordShift.toFixed(0)}m)`);
  if (needsRadius) changes.push(`radio ${currentRadius}m → ${newRadius}m`);
  console.log(`${toll.nombre.padEnd(35)} ${d.passes.length} pasadas ⚑  ${changes.join(' + ')}`);

  proposals.push({ toll, medFoot, newRadius, coordShift, p90, passes: d.passes.length, needsCoord, needsRadius, currentRadius });
}

console.log('─'.repeat(80));
console.log(`\n${proposals.length} peaje${proposals.length !== 1 ? 's' : ''} con cambios propuestos\n`);

if (proposals.length === 0 || !apply) {
  if (!apply && proposals.length > 0) {
    console.log('Corre con --apply para actualizar tolls.json\n');
  }
  process.exit(0);
}

// ── Apply ────────────────────────────────────────────────────────────────────
let changed = 0;
for (const p of proposals) {
  const toll = tollsData.tolls.find(t => t.id === p.toll.id);
  if (!toll) continue;

  if (p.needsCoord) {
    toll.lat = parseFloat(p.medFoot.lat.toFixed(6));
    toll.lng = parseFloat(p.medFoot.lng.toFixed(6));
  }
  if (p.needsRadius) {
    toll.radio_deteccion_m = p.newRadius;
  }
  changed++;
  console.log(`✓ ${toll.nombre}: ${p.needsCoord ? `lat=${toll.lat}, lng=${toll.lng}` : ''} ${p.needsRadius ? `radio=${toll.radio_deteccion_m}m` : ''}`);
}

const updated = JSON.stringify(tollsData, null, 2);
writeFileSync(TOLLS_FE, updated);
writeFileSync(TOLLS_APP, updated);
console.log(`\n✓ tolls.json actualizado (frontend + app) — ${changed} peaje${changed !== 1 ? 's' : ''} calibrado${changed !== 1 ? 's' : ''}`);

if (!createPR) {
  console.log('\nCorre con --pr para crear un Pull Request automático.\n');
  process.exit(0);
}

// ── Create PR ────────────────────────────────────────────────────────────────
const branch = `calibration/${new Date().toISOString().slice(0, 10)}`;
const summary = proposals.map(p =>
  `- ${p.toll.nombre}: ${p.needsCoord ? `coords (${p.coordShift.toFixed(0)}m shift, ${p.passes} pasadas)` : ''}${p.needsRadius ? ` radio ${p.currentRadius}→${p.newRadius}m` : ''}`
).join('\n');

try {
  execSync(`git checkout -b ${branch}`, { stdio: 'inherit' });
  execSync(`git add frontend/src/data/tolls.json app/src/data/tolls.json`, { stdio: 'inherit' });
  execSync(`git commit -m "calibration: update ${changed} toll(s) from GPS data (${DAYS}d window)"`, { stdio: 'inherit' });
  execSync(`git push -u origin ${branch}`, { stdio: 'inherit' });
  execSync(`gh pr create --title "GPS calibration: ${changed} toll(s) — ${new Date().toISOString().slice(0,10)}" --body "## GPS Calibration Agent\n\nAnálisis automático de ${tripsWithPositions} viajes con GPS.\n\n### Cambios\n${summary}\n\n### Criterios\n- Mínimo ${MIN_PASSES} pasadas por peaje\n- Coords: shift mediano > ${MIN_COORD_SHIFT}m\n- Radio: P90 closest approach × ${RADIUS_MARGIN}\n\n🤖 Generado por GPS Calibration Agent"`, { stdio: 'inherit' });
  execSync(`git checkout main`, { stdio: 'inherit' });
} catch (e) {
  console.error('Error creando PR:', e.message);
}
