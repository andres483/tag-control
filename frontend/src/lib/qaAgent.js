/**
 * QA Agent — detecta anomalías en Supabase y las surfea en el Admin.
 *
 * Checks:
 *  1. live_trips activos hace >2h (viaje olvidado / app crasheó)
 *  2. trips con 0 peajes en las últimas 24h (falla de detección)
 *  3. usuarios que hicieron viaje hoy pero 0 peajes detectados (patrón de falla)
 *
 * Retorna { findings, runAt, healthy }
 * findings: [{ type, severity, message, detail, data }]
 */

import { supabase } from './supabase';

export async function runQAAgent() {
  const findings = [];
  const now = Date.now();

  // ── Check 1: live_trips atascados (>2h activos sin update) ────────────────
  const staleThreshold = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const { data: staleTrips } = await supabase
    .from('live_trips')
    .select('id, driver, created_at, updated_at, platform')
    .eq('is_active', true)
    .lt('updated_at', staleThreshold);

  if (staleTrips?.length > 0) {
    findings.push({
      type: 'stale_trips',
      severity: 'error',
      message: `${staleTrips.length} viaje${staleTrips.length > 1 ? 's' : ''} activo${staleTrips.length > 1 ? 's' : ''} hace >2h`,
      detail: staleTrips.map(t => `${t.driver} (${t.platform || 'web'})`).join(' · '),
      action: 'Cerrar viaje',
      data: staleTrips,
    });
  }

  // ── Check 2: trips con 0 peajes (últimas 24h) ────────────────────────────
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data: zeroTollTrips } = await supabase
    .from('trips')
    .select('id, driver, start_time, platform, toll_count')
    .eq('toll_count', 0)
    .gte('created_at', dayAgo)
    .order('created_at', { ascending: false });

  if (zeroTollTrips?.length > 0) {
    findings.push({
      type: 'zero_toll_trips',
      severity: 'warning',
      message: `${zeroTollTrips.length} viaje${zeroTollTrips.length > 1 ? 's' : ''} sin peajes detectados`,
      detail: zeroTollTrips.map(t => `${t.driver} · ${t.platform || 'web'}`).join(' · '),
      action: 'Reconstruir desde GPS',
      data: zeroTollTrips,
    });
  }

  // ── Check 3: usuarios con patrón de falla (≥2 viajes 0 peajes esta semana) ─
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: weekTrips } = await supabase
    .from('trips')
    .select('driver, toll_count')
    .gte('created_at', weekAgo);

  if (weekTrips?.length > 0) {
    const zeroByDriver = {};
    const totalByDriver = {};
    for (const t of weekTrips) {
      totalByDriver[t.driver] = (totalByDriver[t.driver] || 0) + 1;
      if ((t.toll_count || 0) === 0) {
        zeroByDriver[t.driver] = (zeroByDriver[t.driver] || 0) + 1;
      }
    }
    const problemDrivers = Object.entries(zeroByDriver)
      .filter(([driver, zeros]) => zeros >= 2 && zeros / (totalByDriver[driver] || 1) > 0.5)
      .map(([driver, zeros]) => `${driver} (${zeros}/${totalByDriver[driver]})`);

    if (problemDrivers.length > 0) {
      findings.push({
        type: 'detection_pattern',
        severity: 'warning',
        message: `Patrón de falla detectado en ${problemDrivers.length} usuario${problemDrivers.length > 1 ? 's' : ''}`,
        detail: problemDrivers.join(' · '),
        action: 'Revisar permisos GPS',
        data: problemDrivers,
      });
    }
  }

  return {
    findings,
    runAt: new Date().toISOString(),
    healthy: findings.length === 0,
  };
}
