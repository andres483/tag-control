import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const USER_KEY = 'tagcontrol_user';

export async function getStoredUser() {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function login(name, pin) {
  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('name', name)
    .eq('pin', pin)
    .single();

  if (existing) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(existing));
    return existing;
  }

  // Try to register
  const { data: byName } = await supabase
    .from('users')
    .select('name')
    .eq('name', name)
    .single();

  if (byName) return null; // Name exists but wrong PIN

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ name, pin })
    .select()
    .single();

  if (error) return null;

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
  return newUser;
}

export async function logout() {
  await SecureStore.deleteItemAsync(USER_KEY);
}
