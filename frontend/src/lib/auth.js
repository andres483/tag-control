import { supabase } from './supabase';

const AUTH_KEY = 'tagcontrol_auth';

/**
 * Registrar usuario nuevo (nombre + PIN)
 */
export async function registerUser(name, pin) {
  const { error } = await supabase.from('users').insert({
    name,
    pin,
    created_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === '23505') throw new Error('Ese nombre ya está registrado');
    throw error;
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify({ name }));
  return { name };
}

/**
 * Login con nombre + PIN
 */
export async function loginUser(name, pin) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .eq('pin', pin)
    .single();

  if (error || !data) throw new Error('Nombre o PIN incorrecto');
  localStorage.setItem(AUTH_KEY, JSON.stringify({ name: data.name }));
  return { name: data.name };
}

/**
 * Obtener usuario logueado (desde localStorage)
 */
export function getCurrentUser() {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

/**
 * Cerrar sesión
 */
export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
