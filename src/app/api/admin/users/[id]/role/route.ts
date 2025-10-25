// PATCH

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { role } = await req.json();

  if (!['student', 'staff', 'admin'].includes(role))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  // 1) Update Prisma
  const updated = await prisma.user.update({
    where: { id },
    data: { role },
  });

  // 2) Mirror to Supabase app_metadata for middleware
  await supabaseAdmin.auth.admin.updateUserById(id, { app_metadata: { role } });

  return NextResponse.json(updated);
}
