export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
function clientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return '0.0.0.0';
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit({
    key: `pwreset:${ip}`,
    limit: 3,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    const { email } = await req.json();
    const address = String(email || '')
      .trim()
      .toLowerCase();

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      new URL(req.url).origin;

    if (address) {
      const supabase = await createServerSupabase();
      await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${origin}/reset-password`,
      });
    }
    // Always respond ok
    return NextResponse.json({ ok: true });
  } catch {
    // Still respond ok to avoid leaking info
    return NextResponse.json({ ok: true });
  }
}
