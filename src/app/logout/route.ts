import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

// Clears the session cookie and lands on the sign-in page. The role layouts
// send browsers here when the cookie points at an account that no longer
// checks out (removed driver, deactivated admin), so a stale cookie can
// never bounce between pages in a redirect loop.
export async function GET(request: Request) {
  const error = new URL(request.url).searchParams.get('error');
  const target = new URL('/login', request.url);
  if (error) target.searchParams.set('error', error);

  const response = NextResponse.redirect(target);
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
