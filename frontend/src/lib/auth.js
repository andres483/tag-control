import { supabase } from './supabase';

const AUTH_KEY = 'tagcontrol_auth';

export async function registerUser(name, pin) {
  const { error } = await supabase.from('users').insert({
    name,
    pin,
    created_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === '23505') throw new Error('Ese nombre ya está registrado. Toca "Entrar".');
    throw new Error('Error al registrar: ' + (error.message || 'intenta de nuevo'));
  }
  // Guardar sesión
  try { localStorage.setItem(AUTH_KEY, JSON.stringify({ name })); } catch {}
  return { name };
}

export async function loginUser(name, pin) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .eq('pin', pin)
    .single();

  if (error || !data) throw new Error('Nombre o PIN incorrecto');
  try { localStorage.setItem(AUTH_KEY, JSON.stringify({ name: data.name })); } catch {}
  return { name: data.name };
}

export function getCurrentUser() {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export function logout() {
  try { localStorage.removeItem(AUTH_KEY); } catch {}
}
