import { Platform } from 'react-native';
import { supabase } from './supabase';

const PLATFORM = Platform.OS; // 'ios' | 'android'

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
  await supabase.from('positions').insert({ trip_id: tripId, lat, lng, speed });
}

export async function endLiveTrip(id) {
  await supabase.from('live_trips').update({
    is_active: false, updated_at: new Date().toISOString(),
  }).eq('id', id);
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
