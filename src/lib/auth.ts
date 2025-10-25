'use client';

import { createBrowserClient } from '@/lib/supabase/client';

export function setUserCache(
  email: string,
  role: 'student' | 'staff' | 'admin'
) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user_email', email);
  localStorage.setItem('user_role', role);
}

export function clearUserCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user_email');
  localStorage.removeItem('user_role');
}

/** Quick UI reads (sync) */
export function getUserEmail(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('user_email') ?? '';
}

export function getUserRole(): 'student' | 'staff' | 'admin' | '' {
  if (typeof window === 'undefined') return '';
  const role = localStorage.getItem('user_role');
  if (role === 'admin' || role === 'staff' || role === 'student') return role;
  return '';
}

/** Check whether a Supabase session currently exists */
export async function isAuthenticated(): Promise<boolean> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Logout: end Supabase session + clear cache + redirect */
export async function logout() {
  const supabase = createBrowserClient();
  try {
    await supabase.auth.signOut(); // clears both access & refresh cookies
  } catch (e) {
    console.error('Supabase signOut error:', e);
  }
  clearUserCache();
  window.location.replace('/login');
}
