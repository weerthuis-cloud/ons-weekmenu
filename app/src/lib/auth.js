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
  // Eén auth-user kan meerdere profielen hebben (Peter + Miranda samen).
  // We laden alle gekoppelde profielen; primaire = peter als beschikbaar, anders eerste.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, slug, naam, kleur_hue')
    .eq('user_id', userId);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  // Primaire profile: peter > miranda > anders eerste alfabetisch
  const ordered = [...data].sort((a, b) =>
    (a.slug === 'peter' ? -1 : 1) - (b.slug === 'peter' ? -1 : 1)
  );
  return ordered[0];
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

  // Reageer op login/logout en password-recovery
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      // Supabase heeft de recovery-token in de URL gezien en een tijdelijke session opgezet.
      // We tonen het wachtwoord-set-formulier in plaats van de app.
      setState({ status: 'recovery', user: session?.user ?? null, profile: null, error: null });
      return;
    }
    handleSession(session);
  });
}

export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase niet geconfigureerd.');
  const trimmed = email.trim().toLowerCase();
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(trimmed)) {
    throw new Error('Dit e-mailadres staat niet op de toegestane lijst.');
  }
  if (!password) throw new Error('Wachtwoord verplicht.');
  const { error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });
  if (error) throw error;
}

// Wijzig wachtwoord van de huidige (recovery-)session.
export async function updatePassword(newPassword) {
  if (!supabase) throw new Error('Supabase niet geconfigureerd.');
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Wachtwoord moet minimaal 6 tekens zijn.');
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  // Trigger volledige session-refresh (status → ready)
  const { data: { session } } = await supabase.auth.getSession();
  await handleSession(session);
}

export async function sendPasswordReset(email) {
  if (!supabase) throw new Error('Supabase niet geconfigureerd.');
  const trimmed = email.trim().toLowerCase();
  if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(trimmed)) {
    throw new Error('Dit e-mailadres staat niet op de toegestane lijst.');
  }
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: window.location.origin + window.location.pathname,
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
    .insert({ user_id: user.id, slug, naam, kleur_hue })
    .select()
    .single();
  if (error) throw error;
  setState({ status: 'ready', profile: data });
  return data;
}
