import { NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { authenticateWithMagicLink, createJWTToken } from '@/lib/auth-middleware';

/**
 * GET /api/auth/verify?token=... - Verify magic link token and set session cookie
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }

  try {
    const authResult = await authenticateWithMagicLink(token);

    if (!authResult.success || !authResult.context?.user) {
      return NextResponse.redirect(new URL('/login?error=invalid_or_expired', request.url));
    }

    // Create JWT token
    const jwtToken = createJWTToken(
      authResult.context.user.id,
      authResult.context.user.email
    );

    // Create response with redirect to dashboard
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    
    // Set auth cookie
    response.cookies.set('auth-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error verifying magic link:', error);
    return NextResponse.redirect(new URL('/login?error=server_error', request.url));
  }
}