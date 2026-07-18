import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/', '/api/auth/callback'];
const PROTECTED_ROUTES = ['/dashboard', '/profile', '/groups', '/matches', '/create-match'];

const AUTH_COOKIE_NAME = 'pubg-auth-session';

function hasValidSession(request: NextRequest): boolean {
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
  return !!authCookie?.value;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route));
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route));
  
  const hasSession = hasValidSession(request);
  
  if (isProtectedRoute && !hasSession) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  if (pathname === '/' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};