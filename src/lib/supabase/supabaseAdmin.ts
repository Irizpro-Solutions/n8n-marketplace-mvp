// Fixed src/lib/supabase/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

// Create a function to get admin client instead of top-level initialization
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

// Export for backward compatibility if needed elsewhere
export const supabaseAdmin = {
  getInstance: getSupabaseAdmin
};