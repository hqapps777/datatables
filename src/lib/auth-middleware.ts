import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { users, magicLinks, apiKeys } from '@/server/db/schema';
import { PermissionChecker, PermissionContext, createPermissionContext } from './permissions';

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-here';

// Auth context interface
export interface AuthContext {
  user?: {
    id: number;
    email: string;
    name: string;
  };
  apiKey?: {
    id: number;
    name: string;
    scope: string;
    scopeId: number;
    role: string;
  };
  publicSlug?: string;
  permissionContext: PermissionContext;
}

// Authentication result
export interface AuthResult {
  success: boolean;
  context?: AuthContext;
  error?: string;
}

/**
 * Main authentication middleware
 */
export async function authenticate(request: NextRequest): Promise<AuthResult> {
  // Check for JWT token in cookies
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  
  if (token) {
    const jwtResult = await authenticateWithJWT(token);
    if (jwtResult.success) {
      return jwtResult;
    }
  }

  // Check for JWT token in Authorization header
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const headerToken = authHeader.replace('Bearer ', '');
    
    // First try as JWT token
    const jwtResult = await authenticateWithJWT(headerToken);
    if (jwtResult.success) {
      return jwtResult;
    }
    
    // If JWT fails, try as API key
    const apiResult = await authenticateWithAPIKey(headerToken);
    if (apiResult.success) {
      return apiResult;
    }
  }

  // Check for API key in x-api-key header
  const apiKey = headersList.get('x-api-key');
  if (apiKey) {
    const apiResult = await authenticateWithAPIKey(apiKey);
    if (apiResult.success) {
      return apiResult;
    }
  }

  // Check for public slug access
  const url = new URL(request.url);
  const publicSlug = url.searchParams.get('slug');
  
  if (publicSlug) {
    return {
      success: true,
      context: {
        publicSlug,
        permissionContext: createPermissionContext({ publicSlug })
      }
    };
  }

  return {
    success: false,
    error: 'No valid authentication found'
  };
}

/**
 * Authenticate using JWT token
 */
async function authenticateWithJWT(token: string): Promise<AuthResult> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user[0]) {
      return { success: false, error: 'User not found' };
    }

    const userData = user[0];
    const context: AuthContext = {
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name
      },
      permissionContext: createPermissionContext({
        userId: userData.id,
        email: userData.email
      })
    };

    return { success: true, context };
  } catch (error) {
    return { success: false, error: 'Invalid JWT token' };
  }
}

/**
 * Authenticate using API key
 */
async function authenticateWithAPIKey(apiKey: string): Promise<AuthResult> {
  console.log('🔍 API KEY DEBUG - Authentication start:', {
    apiKeyReceived: apiKey ? `${apiKey.substring(0, 12)}...` : 'NO_API_KEY'
  });

  // 🔧 BUGFIX: Get all non-revoked API keys and compare using bcrypt.compare
  const allKeys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.revokedAt, null as any)); // Not revoked

  console.log('🔍 API KEY DEBUG - Database results:', {
    totalActiveKeys: allKeys.length
  });

  let validKey = null;
  
  // Check each key to find matching hash
  for (const key of allKeys) {
    const isValid = await bcrypt.compare(apiKey, key.tokenHash);
    console.log('🔍 API KEY DEBUG - Key comparison:', {
      keyId: key.id,
      keyName: key.name,
      tokenMatches: isValid
    });
    
    if (isValid) {
      validKey = key;
      break;
    }
  }

  if (!validKey) {
    console.log('❌ API KEY DEBUG - No valid key found');
    return { success: false, error: 'Invalid API key' };
  }

  console.log('✅ API KEY DEBUG - Valid key found:', {
    keyId: validKey.id,
    keyName: validKey.name,
    scope: validKey.scope,
    role: validKey.role
  });

  const context: AuthContext = {
    apiKey: {
      id: validKey.id,
      name: validKey.name,
      scope: validKey.scope,
      scopeId: validKey.scopeId,
      role: validKey.role
    },
    permissionContext: createPermissionContext({
      apiKey: apiKey
    })
  };

  return { success: true, context };
}

/**
 * Magic link authentication
 */
export async function authenticateWithMagicLink(token: string): Promise<AuthResult> {
  // 🔍 DIAGNOSTIC LOGGING for Magic Link verification
  const currentTime = new Date();
  console.log('🔍 MAGIC LINK DEBUG - Verification start:', {
    currentTime: currentTime.toISOString(),
    currentTimeLocal: currentTime.toString(),
    tokenReceived: token ? `${token.substring(0, 8)}...` : 'NO_TOKEN',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  // 🔍 DEBUG: Check ALL magic links first (including used ones)
  const allMagicLinks = await db
    .select({
      id: magicLinks.id,
      email: magicLinks.email,
      tokenHash: magicLinks.tokenHash,
      expiresAt: magicLinks.expiresAt,
      usedAt: magicLinks.usedAt,
      createdAt: magicLinks.createdAt
    })
    .from(magicLinks)
    .orderBy(magicLinks.createdAt);

  console.log('🔍 MAGIC LINK DEBUG - ALL links in database:', {
    totalAllLinks: allMagicLinks.length,
    recentLinks: allMagicLinks.slice(-3).map(link => ({
      id: link.id,
      email: link.email,
      createdAt: link.createdAt.toISOString(),
      expiresAt: link.expiresAt.toISOString(),
      usedAt: link.usedAt?.toISOString() || 'NOT_USED',
      isExpiredNow: link.expiresAt < currentTime,
      minutesUntilExpiry: Math.round((link.expiresAt.getTime() - currentTime.getTime()) / (1000 * 60))
    }))
  });

  // Find magic links and verify token by comparing with stored hash
  // 🔧 CRITICAL FIX: Use isNull() instead of eq(field, null) for PostgreSQL
  const magicLinkResults = await db
    .select({
      id: magicLinks.id,
      email: magicLinks.email,
      tokenHash: magicLinks.tokenHash,
      expiresAt: magicLinks.expiresAt,
      usedAt: magicLinks.usedAt
    })
    .from(magicLinks)
    .where(isNull(magicLinks.usedAt)); // 🔧 CRITICAL FIX: Correct NULL check

  console.log('🔍 MAGIC LINK DEBUG - Database results (unused only):', {
    totalUnusedLinks: magicLinkResults.length,
    links: magicLinkResults.map(link => ({
      id: link.id,
      email: link.email,
      expiresAt: link.expiresAt.toISOString(),
      expiresAtLocal: link.expiresAt.toString(),
      isExpiredNow: link.expiresAt < currentTime,
      minutesUntilExpiry: Math.round((link.expiresAt.getTime() - currentTime.getTime()) / (1000 * 60))
    }))
  });

  let validLink = null;
  
  // Check each unused link to find matching token hash
  for (const link of magicLinkResults) {
    const isValid = await bcrypt.compare(token, link.tokenHash);
    console.log('🔍 MAGIC LINK DEBUG - Token comparison:', {
      linkId: link.id,
      email: link.email,
      tokenMatches: isValid
    });
    
    if (isValid) {
      validLink = link;
      break;
    }
  }

  if (!validLink) {
    console.log('❌ MAGIC LINK DEBUG - No valid link found');
    return { success: false, error: 'Invalid magic link' };
  }

  // Check if expired
  const isExpired = validLink.expiresAt < new Date();
  console.log('🔍 MAGIC LINK DEBUG - Expiry check:', {
    linkId: validLink.id,
    email: validLink.email,
    expiresAt: validLink.expiresAt.toISOString(),
    currentTime: new Date().toISOString(),
    isExpired,
    minutesDifference: Math.round((validLink.expiresAt.getTime() - new Date().getTime()) / (1000 * 60))
  });

  if (isExpired) {
    console.log('❌ MAGIC LINK DEBUG - Link expired!');
    return { success: false, error: 'Magic link expired' };
  }

  // Mark as used
  await db
    .update(magicLinks)
    .set({ usedAt: new Date() })
    .where(eq(magicLinks.id, validLink.id));

  // Get or create user
  let user = await db
    .select()
    .from(users)
    .where(eq(users.email, validLink.email))
    .limit(1);

  let isNewUser = false;
  if (!user[0]) {
    // Create new user
    const newUsers = await db
      .insert(users)
      .values({
        email: validLink.email,
        name: validLink.email.split('@')[0], // Use email prefix as default name
      })
      .returning();
    
    user = newUsers;
    isNewUser = true;
  }

  const userData = user[0];
  
  // Create default workspace for new users
  if (isNewUser) {
    const { workspaces, folders } = await import('@/server/db/schema');
    
    // Create default workspace
    const newWorkspace = await db
      .insert(workspaces)
      .values({
        name: 'Mein Arbeitsbereich',
        ownerUserId: userData.id,
      })
      .returning();

    // Create default folder in the workspace
    if (newWorkspace[0]) {
      await db
        .insert(folders)
        .values({
          name: 'Hauptordner',
          workspaceId: newWorkspace[0].id,
        });
    }
  }

  const context: AuthContext = {
    user: {
      id: userData.id,
      email: userData.email,
      name: userData.name
    },
    permissionContext: createPermissionContext({
      userId: userData.id,
      email: userData.email
    })
  };

  return { success: true, context };
}

/**
 * Authorization middleware - checks permissions for specific resources
 */
export interface AuthorizationOptions {
  tableId?: number;
  folderId?: number;
  workspaceId?: number;
  requiredPermission: 'view' | 'edit' | 'manage';
}

export async function authorize(
  context: AuthContext,
  options: AuthorizationOptions
): Promise<{ authorized: boolean; error?: string }> {
  const checker = new PermissionChecker(context.permissionContext);

  try {
    if (options.tableId) {
      const permission = await checker.getTablePermission(options.tableId);
      
      switch (options.requiredPermission) {
        case 'view':
          return { authorized: permission.canView };
        case 'edit':
          return { authorized: permission.canEdit };
        case 'manage':
          return { authorized: permission.canManage };
      }
    }

    if (options.folderId) {
      const permission = await checker.getFolderPermission(options.folderId);
      
      switch (options.requiredPermission) {
        case 'view':
          return { authorized: permission.canView };
        case 'edit':
          return { authorized: permission.canEdit };
        case 'manage':
          return { authorized: permission.canManage };
      }
    }

    if (options.workspaceId) {
      const permission = await checker.getWorkspacePermission(options.workspaceId);
      
      switch (options.requiredPermission) {
        case 'view':
          return { authorized: permission.canView };
        case 'edit':
          return { authorized: permission.canEdit };
        case 'manage':
          return { authorized: permission.canManage };
      }
    }

    return { authorized: false, error: 'No resource specified for authorization' };
  } catch (error) {
    return { authorized: false, error: 'Authorization check failed' };
  }
}

/**
 * Combined middleware function for API routes
 */
export async function withAuth(
  request: NextRequest,
  options?: AuthorizationOptions
): Promise<{ success: boolean; context?: AuthContext; response?: NextResponse }> {
  // Authenticate
  const authResult = await authenticate(request);
  
  if (!authResult.success || !authResult.context) {
    return {
      success: false,
      response: NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    };
  }

  // Authorize if options provided
  if (options) {
    const authzResult = await authorize(authResult.context, options);
    
    if (!authzResult.authorized) {
      return {
        success: false,
        response: NextResponse.json(
          { error: authzResult.error || 'Insufficient permissions' },
          { status: 403 }
        )
      };
    }
  }

  return {
    success: true,
    context: authResult.context
  };
}

/**
 * Helper to create JWT token
 */
export function createJWTToken(userId: number, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

/**
 * Helper to hash API key
 */
export async function hashAPIKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10);
}

/**
 * Helper to generate API key
 */
export function generateAPIKey(): string {
  return `dtk_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
}