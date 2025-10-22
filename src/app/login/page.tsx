'use client';

import type React from 'react';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

const TEST_CREDENTIALS = {
  user: { email: 'user@mail.apu.edu.my', password: 'user123', role: 'user' },
  staff: {
    email: 'staff@mail.apu.edu.my',
    password: 'staff123',
    role: 'staff',
  },
  admin: {
    email: 'admin@mail.apu.edu.my',
    password: 'admin123',
    role: 'admin',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const matchedAccount = Object.values(TEST_CREDENTIALS).find(
        (cred) => cred.email === email && cred.password === password
      );

      if (matchedAccount) {
        localStorage.setItem('auth_token', 'demo_token');
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_role', matchedAccount.role);
        if (matchedAccount.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/');
        }
      } else {
        setError('Invalid email or password');
        setIsLoading(false);
      }
    }, 1000);
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
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Need Help?</DialogTitle>
                  <DialogDescription className="pt-4">
                    Having troubles? No worries! You can reach us at{' '}
                    <a
                      href="mailto:assist@staffemail.apu.edu.my"
                      className="text-primary font-medium hover:underline"
                    >
                      assist@staffemail.apu.edu.my
                    </a>{' '}
                    and our team will assist you.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>

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
