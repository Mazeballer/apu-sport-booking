import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = await req
      .json()
      .catch(() => ({} as any));
    const supabase = await createServerSupabase();

    // If tokens are null or missing, clear auth cookies on the server
    if (!access_token || !refresh_token) {
      await supabase.auth.signOut();
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unexpected error' },
      { status: 500 }
    );
  }
}
