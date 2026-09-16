import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'session';

const secretString = process.env.AUTH_SECRET;
const secret =
  secretString && secretString.length >= 32 ? new TextEncoder().encode(secretString) : null;

async function getPayload(token: string | undefined) {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { role?: string };
  } catch {
    return null;
  }
}

const homeFor = (role?: string) => (role === 'driver' ? '/driver' : '/admin');

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const payload = await getPayload(request.cookies.get(SESSION_COOKIE)?.value);
  const role = payload?.role;

  // The management sign-in lives under /admin but must stay reachable when
  // signed out. Anyone already signed in gets sent to their home screen.
  if (pathname === '/admin/login') {
    if (role) return NextResponse.redirect(new URL(homeFor(role), request.url));
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') && role !== 'admin') {
    const url = new URL('/admin/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/driver') && role !== 'driver') {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/login' && role) {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/driver/:path*', '/admin/:path*', '/login'],
};