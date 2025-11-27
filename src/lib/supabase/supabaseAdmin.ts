// src/lib/supabase/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // service_role key from Supabase

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('Missing SUPABASE env vars in supabaseAdmin.ts');
}

// This is a single admin client instance that bypasses RLS
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});
