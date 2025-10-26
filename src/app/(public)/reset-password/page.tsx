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
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Enter your new password</CardDescription>
        </CardHeader>
        <CardContent>
          {!tokenReady && !done ? (
            <Alert variant="destructive">
              <AlertDescription>{err || 'Checking link...'}</AlertDescription>
            </Alert>
          ) : done ? (
            <Alert>
              <AlertDescription>
                Password updated. Redirecting to login.
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
