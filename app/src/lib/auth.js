// Auth-laag boven de Supabase-client.
// Houdt session + profile (peter / miranda) bij en notificeert listeners.

import { supabase, ALLOWED_EMAILS } from './supabase.js';

const listeners = new Set();

const authState = {
  status: 'loading', // 'loading' | 'anonymous' | 'needs_onboarding' | 'ready' | 'denied'
  user: null,        // auth.user
  profile: null,     // public.profiles row
  error: null,
};

export function getAuthState() {
  return authState;
}

export function onAuthChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  for (const cb of listeners) cb(authState);
}

function setState(patch) {
  Object.assign(authState, patch);
  emit();
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, slug, naam, kleur_hue')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data; // null als nog geen profile
}

async function handleSession(session) {
  if (!session) {
    setState({ status: 'anonymous', user: null, profile: null, error: null });
    return;
  }
  const user = session.user;
  // Soft email-allowlist (strikte handhaving via signup-disable in dashboard)
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email)) {
    await supabase.auth.signOut();
    setState({
      status: 'denied',
      user: null,
      profile: null,
      error: `E-mail ${user.email} staat niet op de toegestane lijst.`,
    });
    return;
  }
  try {
    const profile = await loadProfile(user.id);
    if (!profile) {
      setState({ status: 'needs_onboarding', user, profile: null, error: null });
    } else {
      setState({ status: 'ready', user, profile, error: null });
    }
  } catch (err) {
    setState({ status: 'anonymous', user: null, profile: null, error: err.message });
  }
}

export async function initAuth() {
  if (!supabase) {
    setState({ status: 'anonymous', error: 'Supabase niet geconfigureerd.' });
    return;
  }
  // Laad bestaande session (uit localStorage)
  const { data: { session } } = await supabase.auth.getSession();
  await handleSession(session);

  // Reageer op login/logout in dezelfde tab of via magic link
  supabase.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });
}

export async function signInWithEmail(email) {
  if (!supabase) throw new Error('Supabase niet geconfigureerd.');
  const trimmed = email.trim().toLowerCase();
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(trimmed)) {
    throw new Error('Dit e-mailadres staat niet op de toegestane lijst.');
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function createOwnProfile({ slug, naam }) {
  if (!supabase) throw new Error('Supabase niet geconfigureerd.');
  const user = authState.user;
  if (!user) throw new Error('Niet ingelogd.');
  const kleur_hue = slug === 'peter' ? 260 : 340;
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: user.id, slug, naam, kleur_hue })
    .select()
    .single();
  if (error) throw error;
  setState({ status: 'ready', profile: data });
  return data;
}
