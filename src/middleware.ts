// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow API, Next internals, and static files
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // public routes
  const publicRoutes = ["/login", "/forgot-password", "/reset-password"];
  if (publicRoutes.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // create a response up front so we can attach refreshed cookies to it
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  // verify with Supabase Auth server
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    const url = new URL("/login", req.url);
    // internal paths only
    const back = pathname.startsWith("/") ? pathname : "/";
    url.searchParams.set("redirect", back);
    return NextResponse.redirect(url);
  }

  return res;
}

// match everything except api, _next, and files
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
