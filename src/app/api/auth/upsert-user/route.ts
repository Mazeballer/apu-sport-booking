// app/api/auth/upsert-user/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await prisma.user.upsert({
    where: { email: user.email ?? `no-email-${user.id}@placeholder.local` },
    update: { authId: user.id, name: user.user_metadata?.full_name ?? '' },
    create: {
      authId: user.id,
      email: user.email ?? `no-email-${user.id}@placeholder.local`,
      name: user.user_metadata?.full_name ?? '',
      role: 'student', // default role
    },
    select: { id: true, role: true },
  });

  return NextResponse.json({ ok: true, role: row.role });
}
