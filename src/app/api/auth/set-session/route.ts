import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token } = await req.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
    }

    // This sets the auth cookies on the server so middleware can see them
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'Unexpected error' },
      { status: 500 }
    );
  }
}

