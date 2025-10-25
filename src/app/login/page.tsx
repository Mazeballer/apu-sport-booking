'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notify } from '@/lib/toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';

/* ---------------------- Login Inner Component ---------------------- */
/* This component actually uses useSearchParams(), so it’s wrapped in Suspense */
function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const supabase = createBrowserClient();

      // 1) Authenticate user
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // 2) Bridge session tokens for SSR middleware
      const session = data.session;
      const bridge = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: session?.access_token,
          refresh_token: session?.refresh_token,
        }),
      });
      if (!bridge.ok) throw new Error('Failed to set auth cookies');

      // 3) Fetch user role
      const res = await fetch(
        `/api/users/role?email=${encodeURIComponent(email)}`
      );
      const { role } = await res.json();

      // 4) Cache locally + toast
      localStorage.setItem('user_email', email);
      localStorage.setItem('user_role', role);
      notify.success('Logged in successfully');

      // 5) Redirect based on role
      const target =
        redirect && redirect !== '/login'
          ? redirect
          : role === 'admin'
          ? '/admin'
          : role === 'staff'
          ? '/staff'
          : '/';
      router.replace(target);
      return;
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Invalid email or password');
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mb-2 overflow-hidden">
            <Image
              src="/apu-logo.png"
              alt="APU Logo"
              width={68}
              height={68}
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">
            APU Sports Booking
          </CardTitle>
          <CardDescription>Sign in to book sports facilities</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="student@mail.apu.edu.my"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-3 border-primary/20 focus:border-primary shadow-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-3 border-primary/20 focus:border-primary shadow-sm"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <Alert className="mt-6 bg-primary/10 border-primary/20">
            <InfoIcon className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <div className="font-semibold mb-2">Test Accounts:</div>
              <div className="space-y-1 font-mono text-xs">
                <div>User: user@mail.apu.edu.my / user123</div>
                <div>Staff: staff@mail.apu.edu.my / staff123</div>
                <div>Admin: admin@mail.apu.edu.my / admin123</div>
              </div>
            </AlertDescription>
          </Alert>

          <Alert className="mt-4 bg-muted border-primary/20">
            <InfoIcon className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              Having troubles? No worries! You can reach us at{' '}
              <a
                href="mailto:assist@staffemail.apu.edu.my"
                className="text-primary font-medium hover:underline"
              >
                assist@staffemail.apu.edu.my
              </a>{' '}
              and our team will assist you.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------- Export wrapped with Suspense ---------------------- */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center p-6 text-muted-foreground">Loading...</div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
