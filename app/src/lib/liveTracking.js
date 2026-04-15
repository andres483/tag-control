import { Platform } from 'react-native';
import { supabase } from './supabase';

const PLATFORM = Platform.OS; // 'ios' | 'android'

// ── Retry helper ─────────────────────────────────────────────────────────────
// Retries a Supabase call up to `retries` times with linear backoff.
// Throws on final failure so callers can handle it explicitly.
async function withRetry(fn, retries = 3, baseDelayMs = 800) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      if (res?.error) throw new Error(res.error.message);
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await new Promise(r => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}

// ── Offline position queue ────────────────────────────────────────────────────
// Positions that failed to insert are buffered here and flushed on the next
// successful insert. Cap at 300 samples (~2.5 h at 30 s intervals).
const MAX_QUEUE = 300;
const _posQueue = [];

export async function flushPositionQueue() {
  if (_posQueue.length === 0) return;
  const batch = _posQueue.splice(0, _posQueue.length);
  try {
    await supabase.from('positions').insert(batch);
  } catch {
    // Still offline — put items back (keep cap)
    _posQueue.unshift(...batch.slice(0, MAX_QUEUE - _posQueue.length));
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function upsertLiveTrip({ id, driver, lat, lng, speed, isActive, totalCost, tollCount, lastToll }) {
  await supabase.from('live_trips').upsert({
    id, driver, lat, lng, speed,
    is_active: isActive,
    total_cost: totalCost,
    toll_count: tollCount,
    last_toll: lastToll || null,
    platform: PLATFORM,
    updated_at: new Date().toISOString(),
  });
}

export async function insertLiveCrossing({ tripId, tollId, tollNombre, tollRuta, tarifa, lat, lng }) {
  await supabase.from('live_crossings').insert({
    trip_id: tripId, toll_id: tollId,
    toll_nombre: tollNombre, toll_ruta: tollRuta,
    tarifa, lat, lng,
  });
}

export async function insertPosition({ tripId, lat, lng, speed }) {
  const row = { trip_id: tripId, lat, lng, speed };
  try {
    await supabase.from('positions').insert(row);
    // Success — opportunistically flush any buffered positions
    if (_posQueue.length > 0) flushPositionQueue().catch(() => {});
  } catch {
    // Network down — buffer for later flush
    if (_posQueue.length < MAX_QUEUE) _posQueue.push(row);
  }
}

// endLiveTrip is critical — retried so the trip doesn't stay open forever
export async function endLiveTrip(id) {
  await withRetry(() =>
    supabase.from('live_trips').update({
      is_active: false, updated_at: new Date().toISOString(),
    }).eq('id', id)
  );
}

export async function closeOrphanedTrips(driver, currentTripId) {
  await supabase.from('live_trips').update({
    is_active: false, updated_at: new Date().toISOString(),
  }).eq('driver', driver).eq('is_active', true).neq('id', currentTripId);
}

export async function cleanupOldPositions() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('positions').delete().lt('created_at', cutoff);
}
