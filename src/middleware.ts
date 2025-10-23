// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 1) Let API, Next internals, and static assets pass
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2) Public routes that don't require auth
  const publicRoutes = ['/login', '/forgot-password', '/reset-password'];
  const isPublic = publicRoutes.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // 3) Create Supabase client with the *middleware* cookie API (getAll/setAll)
  let res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          // If Supabase refreshes cookies, write them onto the response
          res = NextResponse.next({ request: { headers: req.headers } });
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  // 4) Secure: verify user with Supabase Auth server
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // If verification failed or no user -> send to login with redirect back
  if (error || !user) {
    const url = new URL('/login', req.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated -> allow through
  return res;
}

// Next.js 15-safe matcher: exclude /api, _next, and files
export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
