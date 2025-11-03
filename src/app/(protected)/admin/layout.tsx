// app/admin/layout.tsx
export const runtime = 'nodejs';

import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/');

  const me =
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

  if (me?.role !== 'admin') redirect('/');

  return <>{children}</>;
}
