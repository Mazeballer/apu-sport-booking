// src/app/api/users/role/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET() {
  try {
    // 1) Verify the caller by contacting Supabase Auth
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Look up your app user by a trusted identifier
    // Prefer authId first, fall back to email only if needed
    const dbUser =
      (await prisma.user.findUnique({
        where: { authId: user.id },
        select: { role: true },
      })) ??
      (user.email
        ? await prisma.user.findUnique({
            where: { email: user.email },
            select: { role: true },
          })
        : null);

    // 3) Return role without leaking whether a row exists
    return NextResponse.json(
      { role: dbUser?.role ?? 'student' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET /api/users/role error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
