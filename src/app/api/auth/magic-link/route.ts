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

    // 🔍 DIAGNOSTIC LOGGING for Magic Link creation
    const currentTime = new Date();
    console.log('🔗 MAGIC LINK DEBUG - Creation:', {
      email,
      currentTime: currentTime.toISOString(),
      currentTimeLocal: currentTime.toString(),
      expiresAt: expiresAt.toISOString(),
      expiresAtLocal: expiresAt.toString(),
      diffMinutes: Math.round((expiresAt.getTime() - currentTime.getTime()) / (1000 * 60)),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tokenLength: token.length
    });

    // Store magic link
    try {
      console.log('🔍 MAGIC LINK DEBUG - Attempting database insert:', {
        email,
        tokenHashLength: tokenHash.length,
        expiresAt: expiresAt.toISOString()
      });

      const result = await db.insert(magicLinks).values({
        email,
        tokenHash,
        expiresAt,
      }).returning({ id: magicLinks.id });

      console.log('✅ MAGIC LINK DEBUG - Database insert successful:', {
        insertedId: result[0]?.id,
        resultLength: result.length
      });

      // 🔍 IMMEDIATE VERIFICATION: Check if the link is actually stored
      const verifyResult = await db
        .select()
        .from(magicLinks)
        .where(eq(magicLinks.id, result[0].id));
      
      console.log('🔍 MAGIC LINK DEBUG - Immediate verification after insert:', {
        linkId: result[0].id,
        foundInDatabase: verifyResult.length > 0,
        linkData: verifyResult.length > 0 ? {
          email: verifyResult[0].email,
          expiresAt: verifyResult[0].expiresAt.toISOString(),
          isUsed: !!verifyResult[0].usedAt
        } : 'NOT_FOUND'
      });

    } catch (insertError) {
      console.error('❌ MAGIC LINK DEBUG - Database insert failed:', {
        error: insertError,
        errorMessage: insertError instanceof Error ? insertError.message : 'Unknown error',
        errorStack: insertError instanceof Error ? insertError.stack : 'No stack'
      });
      
      // Re-throw the error so the endpoint returns 500
      throw insertError;
    }

    // In a real application, you'd send this via email
    // 🔧 PORT FIX: Get the actual port from the request
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const magicLinkUrl = `${protocol}://${host}/api/auth/verify?token=${token}`;
    
    console.log('🔗 MAGIC LINK DEBUG - URL Generation:', {
      protocol,
      host,
      magicLinkUrl,
      envUrl: process.env.NEXTAUTH_URL
    });

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