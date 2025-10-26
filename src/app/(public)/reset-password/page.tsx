// src/app/(public)/reset-password/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import zxcvbn from 'zxcvbn';
import { CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();

      // If already holding a session, allow form
      const cur = await supabase.auth.getSession();
      if (cur.data.session) {
        setTokenReady(true);
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (!code) {
        setErr('Missing code in the URL. Request a new link.');
        return;
      }

      // Try exchanging PKCE code
      const ex = await supabase.auth.exchangeCodeForSession(code);
      if (ex.error) {
        console.error('exchangeCodeForSession error', ex.error);
        setErr(
          'Invalid or expired reset link. Request a new one and open it in the same browser.'
        );
        return;
      }
      if (ex.data.session) {
        history.replaceState(null, '', window.location.pathname);
        setTokenReady(true);
      }
    };
    run();
  }, []);

  const zx = useMemo(() => zxcvbn(pwd), [pwd]);
  const strong = zx.score >= 3;

  const valid =
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[a-z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd) &&
    pwd === confirm &&
    strong &&
    tokenReady;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setErr('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;

      await supabase.auth.signOut(); // end the one time recovery session
      setDone(true);
      setTimeout(() => router.replace('/login'), 1200);
    } catch (e: any) {
      setErr(e?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-2">
            <svg
              className="w-10 h-10 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Enter your new password</CardDescription>
        </CardHeader>
        <CardContent>
          {!tokenReady && !done ? (
            <Alert variant="destructive">
              <AlertDescription>{err || 'Checking link...'}</AlertDescription>
            </Alert>
          ) : done ? (
            <Alert className="bg-green-200 dark:bg-green-950 border-green-600 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Password updated. Redirecting to login...
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pwd">New password</Label>
                <Input
                  id="pwd"
                  type="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  required
                  minLength={8}
                  className="border-3 border-primary/20 focus:border-primary shadow-sm"
                />
                <div className="h-1.5 w-full bg-muted overflow-hidden rounded">
                  <div
                    className={`h-1.5 ${
                      zx.score >= 3
                        ? 'bg-green-500'
                        : zx.score === 2
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${((zx.score + 1) / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use at least 8 characters with upper, lower, number and symbol
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="border-3 border-primary/20 focus:border-primary shadow-sm"
                />
              </div>

              {err && (
                <Alert variant="destructive">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!valid || loading}
              >
                {loading ? 'Updating...' : 'Reset password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
