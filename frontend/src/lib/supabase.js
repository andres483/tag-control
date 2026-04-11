import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nttnryildsxllxqfkkvz.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_q2xnR7c4SU4DJTNkoc0Dgw_K6-Vfvrr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
