export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sbUser = data.user;
    const email = sbUser.email?.toLowerCase() || '';
    if (!email) {
      return NextResponse.json(
        { error: 'No email on account' },
        { status: 400 }
      );
    }

    // Derive a candidate display name from metadata or email prefix
    const meta = sbUser.user_metadata || {};
    const candidateName =
      String(meta.full_name || meta.name || meta.user_name || '').trim() ||
      email.split('@')[0];

    // Read existing to decide if we should update the name
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { name: true },
    });

    // Only update the name if:
    // 1) the existing name is empty, and
    // 2) the candidate is non empty
    const shouldUpdateName =
      (!existing?.name || existing.name.trim().length === 0) &&
      candidateName.trim().length > 0;

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        authId: sbUser.id,
        role: 'student', // or your desired default
        name: candidateName, // set name only once on create
      },
      update: {
        authId: sbUser.id,
        ...(shouldUpdateName ? { name: candidateName } : {}),
      },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
