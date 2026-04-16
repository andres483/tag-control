import { supabase } from './supabase';

export async function submitFeedback({ driver, type = 'gps_blocked', errorMessage = '', notes = '' }) {
  const ua = navigator.userAgent;
  const platform = /iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'web';
  const { error } = await supabase.from('feedback').insert({
    driver,
    type,
    error_message: errorMessage,
    platform,
    user_agent: ua,
    notes: notes || null,
  });
  return !error;
}
