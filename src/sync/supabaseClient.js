import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://vkpptqfhmkkoovslgvbw.supabase.co';
const DEFAULT_KEY = 'sb_publishable_QwMS0beMceigTWb01sMJYA_upGZQ9ip';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;
