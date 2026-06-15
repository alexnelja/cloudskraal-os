/**
 * Supabase browser client. Uses the publishable anon key (safe in client code —
 * security is enforced server-side by the API's JWT gate + Supabase RLS).
 *
 * Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see frontend/.env.example).
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Fail loudly in dev/build rather than producing a half-working client.
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — auth will not work. See frontend/.env.example.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
