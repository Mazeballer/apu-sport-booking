// app/(protected)/layout.tsx
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface Props {
  children: ReactNode;
}

export default async function ProtectedLayout({ children }: Props) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/');
  return <>{children}</>;
}
