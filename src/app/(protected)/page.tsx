// app/(protected)/page.tsx
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import HomeClient from './HomeClient';

export const runtime = 'nodejs';

export default async function ProtectedHome() {
  // 1. Get the Supabase session (server-side check)
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. If no user, send them to login page
  if (!user) redirect('/login?redirect=/');

  // 3. Fetch the user role from your database
  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { role: true },
  });

  // 4. If the user is an admin, go directly to /admin
  if (dbUser?.role === 'admin') redirect('/admin');

  // 5. Otherwise, render the normal user home UI
  return <HomeClient />;
}
