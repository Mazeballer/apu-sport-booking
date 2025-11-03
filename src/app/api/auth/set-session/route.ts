// src/app/api/auth/set-session/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request) {
  // 1) Only allow JSON POST
  const ct = req.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    return NextResponse.json(
      { error: 'Unsupported Media Type' },
      { status: 415 }
    );
  }

  // 2) Parse body safely (no throws)
  const body = (await req.json().catch(() => null)) as {
    access_token?: string | null;
    refresh_token?: string | null;
    logout?: boolean;
  } | null;

  const supabase = await createServerSupabase();

  // 3) If caller asks to logout, or tokens are missing, clear cookies on the server
  if (
    !body ||
    body.logout === true ||
    !body.access_token ||
    !body.refresh_token
  ) {
    await supabase.auth.signOut(); // clears access and refresh cookies
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // 4) Bridge the session to server cookies
  const { access_token, refresh_token } = body;
  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 400,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  // 5) Success, no body needed
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}
