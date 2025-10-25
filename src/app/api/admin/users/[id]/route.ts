// DELETE database

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  await prisma.user.delete({ where: { id } }).catch(() => null);
  await supabaseAdmin.auth.admin.deleteUser(id);

  return NextResponse.json({ success: true });
}
