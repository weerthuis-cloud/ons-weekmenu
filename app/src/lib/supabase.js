// Supabase-client voor 'ons weekmenu'.
// Configuratie via env-variabelen in .env.local (niet in git):
//   VITE_SUPABASE_URL=https://<projectref>.supabase.co
//   VITE_SUPABASE_ANON_KEY=sb_publishable_...

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    '[supabase] Ontbrekende env-variabelen. Maak een .env.local aan in app/ met VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = (url && key)
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Allowlist: komma-gescheiden lijst e-mails die mogen inloggen.
// Komt uit env-var VITE_ALLOWED_EMAILS (lokaal in .env.local, in productie via GitHub Secret).
// Niet hard in code → repo kan publiek zonder e-mailadressen te lekken.
const allowedRaw = import.meta.env.VITE_ALLOWED_EMAILS || '';
export const ALLOWED_EMAILS = allowedRaw
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);
