import { supabase } from './supabase';

/**
 * Crea o actualiza un viaje en tiempo real en Supabase.
 */
export async function upsertLiveTrip({ id, driver, lat, lng, speed, isActive, totalCost, tollCount, lastToll }) {
  await supabase.from('live_trips').upsert({
    id,
    driver,
    lat,
    lng,
    speed,
    is_active: isActive,
    total_cost: totalCost,
    toll_count: tollCount,
    last_toll: lastToll || null,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Registra un cruce de peaje en Supabase.
 */
export async function insertLiveCrossing({ tripId, tollId, tollNombre, tollRuta, tarifa, lat, lng }) {
  await supabase.from('live_crossings').insert({
    trip_id: tripId,
    toll_id: tollId,
    toll_nombre: tollNombre,
    toll_ruta: tollRuta,
    tarifa,
    lat,
    lng,
  });
}

/**
 * Marca un viaje como terminado.
 */
export async function endLiveTrip(id) {
  await supabase.from('live_trips').update({
    is_active: false,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
}

/**
 * Obtiene todos los viajes activos.
 */
export async function getActiveTrips() {
  const { data } = await supabase
    .from('live_trips')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false });
  return data || [];
}

/**
 * Obtiene los cruces de un viaje.
 */
export async function getTripCrossings(tripId) {
  const { data } = await supabase
    .from('live_crossings')
    .select('*')
    .eq('trip_id', tripId)
    .order('crossed_at', { ascending: true });
  return data || [];
}

/**
 * Suscribirse a cambios en tiempo real de un viaje.
 */
export function subscribeLiveTrips(callback) {
  return supabase
    .channel('live-trips')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_trips' }, callback)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_crossings' }, callback)
    .subscribe();
}
