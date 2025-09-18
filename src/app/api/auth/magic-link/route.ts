import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { magicLinks } from '@/server/db/schema';
import { authenticateWithMagicLink, createJWTToken } from '@/lib/auth-middleware';

/**
 * POST /api/auth/magic-link - Send magic link for authentication
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Generate magic link token
    const token = nanoid(32);
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store magic link
    await db.insert(magicLinks).values({
      email,
      tokenHash,
      expiresAt,
    });

    // In a real application, you'd send this via email
    const magicLinkUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/verify?token=${token}`;

    // Log to server console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔗 Magic Link URL for', email, ':', magicLinkUrl);
    }

    return NextResponse.json({
      message: 'Magic link sent successfully',
      // Only include in development
      ...(process.env.NODE_ENV === 'development' && { magicLinkUrl }),
    });
  } catch (error) {
    console.error('Error creating magic link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/auth/magic-link - Verify magic link token
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  try {
    const authResult = await authenticateWithMagicLink(token);

    if (!authResult.success || !authResult.context) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    // Create JWT token
    const jwtToken = createJWTToken(
      authResult.context.user!.id,
      authResult.context.user!.email
    );

    // Set cookie and return success
    const response = NextResponse.json({
      message: 'Authentication successful',
      user: authResult.context.user,
    });

    response.cookies.set('auth-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Error verifying magic link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}