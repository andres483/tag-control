import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const USER_KEY = 'tagcontrol_user';

// ── PIN hashing ───────────────────────────────────────────────────────────────
// PINs are stored as SHA-256(name:pin) so the DB never holds plaintext.
// Salt includes the username so two users with the same PIN get different hashes.
// Migration: on first login after this deploy, plaintext PINs are detected and
// silently upgraded to hashed form.

async function hashPin(name, pin) {
  const data = new TextEncoder().encode(`${name}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────────────

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
 * For existing users without email, returns { needsEmail: true, user } so the
 * UI can ask for it.
 */
export async function login(name, pin, email) {
  const hashed = await hashPin(name, pin);

  // Try hashed PIN first (new standard)
  let { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .eq('pin', hashed)
    .single();

  // Migration path: if not found by hash, try plaintext (pre-hash users)
  if (!existing) {
    const { data: legacy } = await supabase
      .from('users')
      .select('*')
      .eq('name', name)
      .eq('pin', pin)
      .single();

    if (legacy) {
      // Upgrade plaintext PIN to hashed in the background
      await supabase.from('users').update({ pin: hashed }).eq('name', name);
      legacy.pin = hashed;
      existing = legacy;
    }
  }

  if (existing) {
    if (email && !existing.email) {
      await supabase.from('users').update({ email }).eq('name', name);
      existing.email = email;
    }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(existing));
    if (!existing.email && !email) {
      return { needsEmail: true, user: existing };
    }
    return { user: existing };
  }

  // Check if name exists with any PIN (wrong PIN case)
  const { data: byName } = await supabase
    .from('users')
    .select('name')
    .eq('name', name)
    .single();

  if (byName) return { error: 'PIN incorrecto' };

  // Register new user — email required
  if (!email) return { error: 'Ingresa tu email para registrarte' };

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ name, pin: hashed, email })
    .select()
    .single();

  if (error) return { error: 'Error al registrar' };

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
  return { user: newUser };
}

export async function updateEmail(name, email) {
  await supabase.from('users').update({ email }).eq('name', name);
  // Update stored user
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (raw) {
    const user = JSON.parse(raw);
    user.email = email;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    return user;
  }
}

export async function logout() {
  await SecureStore.deleteItemAsync(USER_KEY);
}
