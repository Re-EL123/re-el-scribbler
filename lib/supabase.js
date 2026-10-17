import { createClient } from '@supabase/supabase-js';
import { ApiError } from './respond.js';

let cached = null;

export function serviceClient() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ApiError(503, 'NOT_CONFIGURED', 'Backend is not configured');
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return cached;
}
