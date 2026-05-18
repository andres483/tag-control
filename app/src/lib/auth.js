import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const USER_KEY = 'tagcontrol_user';

// Reviewer account: works completely offline — Apple review network can block Supabase
const REVIEWER_USER = {
  id: 'demo-local',
  name: 'revisor',
  email: 'revisor@demo.com',
  isDemo: true,
};

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
 * Login / register.
 * Email is the unique identifier. PIN is the password.
 * Name is only required on first registration (when email is new).
 *
 * Legacy fallback: if no account found by email, tries lookup by name
 * so users who registered before email-auth can still log in.
 */
export async function login(email, pin, name) {
  const normalized = email.trim().toLowerCase();

  // Reviewer bypass — works offline, no Supabase needed
  if (normalized === 'revisor' && pin === '2026') {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(REVIEWER_USER));
    return { user: REVIEWER_USER };
  }

  // ── Look up by email (primary) ──────────────────────────────────────────
  let userRow = null;
  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('email', normalized)
      .maybeSingle(); // maybeSingle returns null (not an error) when no rows found
    userRow = data;
  } catch {
    return { error: 'connection' };
  }

  // ── Legacy fallback: look up by name ────────────────────────────────────
  // Covers users who registered before email was the identifier.
  if (!userRow) {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .ilike('name', email.trim())
        .maybeSingle();
      userRow = data;
    } catch {
      // Swallow — treat as "no legacy user found"
    }
  }

  // ── Existing user ───────────────────────────────────────────────────────
  if (userRow) {
    const hashed = await hashPin(userRow.name, pin);
    if (userRow.pin === hashed || userRow.pin === pin) {
      if (userRow.pin === pin) {
        supabase.from('users').update({ pin: hashed }).eq('id', userRow.id).then(() => {});
        userRow.pin = hashed;
      }
      // Silently attach email if missing (legacy user logging in)
      if (!userRow.email && normalized.includes('@')) {
        supabase.from('users').update({ email: normalized }).eq('id', userRow.id).then(() => {});
        userRow.email = normalized;
      }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userRow));
      return { user: userRow };
    }
    return { error: 'PIN incorrecto' };
  }

  // ── New user registration ───────────────────────────────────────────────
  if (!name) return { needsName: true };

  const hashed = await hashPin(name.trim(), pin);
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ name: name.trim(), pin: hashed, email: normalized })
    .select()
    .single();

  if (error) return { error: 'Error al registrar. Intenta de nuevo.' };

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
  return { user: newUser };
}

/**
 * Find or create a user from a verified Google sign-in.
 * No PIN is required — Google itself authenticated the user.
 * A random unusable pin hash is stored so the column stays non-null.
 */
export async function loginWithGoogle(email, name) {
  const normalized = email.trim().toLowerCase();

  // Try to find existing account by email
  let userRow = null;
  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('email', normalized)
      .maybeSingle();
    userRow = data;
  } catch {
    return { error: 'connection' };
  }

  if (userRow) {
    // Always use Google's name — it's the source of truth for Google accounts.
    // Also tries to update the DB (best-effort; may be blocked by RLS).
    const displayUser = { ...userRow, name: name.trim() };
    supabase.from('users').update({ name: name.trim() }).eq('email', normalized).then(() => {});
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(displayUser));
    return { user: displayUser };
  }

  // New Google user — create account with an unusable random pin
  const randomPin = await hashPin('google_auth', normalized + Date.now());
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ name: name.trim(), email: normalized, pin: randomPin })
    .select()
    .single();

  if (error) return { error: 'Error al registrar. Intenta de nuevo.' };

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
  return { user: newUser };
}

export async function logout() {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function deleteAccount(userId, name) {
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
  await supabase.from('users').delete().eq('id', userId);
  await SecureStore.deleteItemAsync(USER_KEY);
}
