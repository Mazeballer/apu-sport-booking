// src/lib/supabase/client.ts
import {
  createClient as createSbClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function createClient() {
  if (client) return client;

  client = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: session?.access_token ?? null,
          refresh_token: session?.refresh_token ?? null,
        }),
      });
    }
    if (event === 'SIGNED_OUT') {
      await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: null,
          refresh_token: null,
        }),
      });
    }
  });

  return client;
}

// keep this export if your code imports createBrowserClient
export const createBrowserClient = createClient;
