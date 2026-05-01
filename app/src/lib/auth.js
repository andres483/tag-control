import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const USER_KEY = 'tagcontrol_user';

async function hashPin(name, pin) {
  const data = new TextEncoder().encode(`${name}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getStoredUser() {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Login: existing user (name + pin) or register new user (name + pin + email).
 * Single Supabase round-trip: fetch full user row, then compare hash locally.
 * Using the stored canonical name for hashing fixes iOS auto-capitalization:
 * "Revisor" typed → finds "revisor" in DB → hashes as "revisor:pin" → matches.
 */
export async function login(name, pin, email) {
  const { data: userRow } = await supabase
    .from('users')
    .select('*')
    .ilike('name', name)
    .single();

  if (userRow) {
    const hashed = await hashPin(userRow.name, pin);

    if (userRow.pin === hashed || userRow.pin === pin) {
      if (userRow.pin === pin) {
        // Legacy plaintext — upgrade to hash silently in background
        supabase.from('users').update({ pin: hashed }).eq('name', userRow.name).then(() => {});
        userRow.pin = hashed;
      }
      if (email && !userRow.email) {
        supabase.from('users').update({ email }).eq('name', userRow.name).then(() => {});
        userRow.email = email;
      }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userRow));
      if (!userRow.email && !email) return { needsEmail: true, user: userRow };
      return { user: userRow };
    }

    return { error: 'PIN incorrecto' };
  }

  // Name not found — register new user
  if (!email) return { error: 'Ingresa tu email para registrarte' };

  const hashed = await hashPin(name, pin);
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ name, pin: hashed, email })
    .select()
    .single();

  if (error) return { error: 'Error al registrar' };

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
  return { user: newUser };
}

export async function logout() {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function deleteAccount(name) {
  const { data: trips } = await supabase.from('trips').select('id').eq('driver', name);
  const { data: liveTrips } = await supabase.from('live_trips').select('id').eq('driver', name);
  const tripIds = [...(trips || []), ...(liveTrips || [])].map(t => t.id);

  if (tripIds.length > 0) {
    await supabase.from('live_crossings').delete().in('trip_id', tripIds);
    await supabase.from('positions').delete().in('trip_id', tripIds);
  }
  await supabase.from('trips').delete().eq('driver', name);
  await supabase.from('live_trips').delete().eq('driver', name);
  await supabase.from('budgets').delete().eq('user_name', name);
  await supabase.from('users').delete().eq('name', name);
  await SecureStore.deleteItemAsync(USER_KEY);
}
