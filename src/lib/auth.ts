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

/** Auth state via Supabase (source of truth) */
export async function isAuthenticated(): Promise<boolean> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/** Proper logout: client signout + clear server cookies + clear cache + redirect */
export async function logout() {
  try {
    const supabase = createBrowserClient();

    // 1) end client session
    await supabase.auth.signOut();

    // 2) clear httpOnly cookies on the server so middleware stops seeing a session
    await fetch('/api/auth/signout', { method: 'POST' });

    // 3) clear local cache
    clearUserCache();

    // 4) hard redirect to login (no history bounce)
    window.location.replace('/login');
  } catch (e) {
    console.error('Logout failed', e);
    window.location.replace('/login');
  }
}
