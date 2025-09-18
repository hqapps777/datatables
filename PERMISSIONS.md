# Datatables Permission System

This document describes the comprehensive permission system implemented for the Datatables application. The system provides role-based access control with support for workspace ownership, sharing, API keys, and public access.

## Overview

The permission system consists of several components:

1. **Permission Types & Interfaces** (`src/lib/permissions.ts`)
2. **Authentication Middleware** (`src/lib/auth-middleware.ts`)
3. **API Routes with Permission Checks** (`src/app/api/`)
4. **Demo & Testing Utilities** (`src/lib/permissions-demo.ts`)

## Permission Hierarchy

### Roles

- **owner** - Full access (view, edit, manage)
- **editor** - Can view and edit, but not manage (delete, share)
- **viewer** - Can only view (read-only access)
- **public** - Public read-only access (no authentication required)

### Resource Levels

1. **Workspace Level** - Workspace owners have full access to everything in their workspace
2. **Folder Level** - Permissions can be shared at folder level (affects all tables in folder)
3. **Table Level** - Individual table permissions

## Authentication Methods

### 1. JWT Token Authentication
Used for logged-in users via magic links.

```typescript
// Example: Check table permission with JWT
const context = createPermissionContext({ 
  userId: 1, 
  email: 'user@example.com' 
});
const checker = new PermissionChecker(context);
const canEdit = await checker.canEditTable(123);
```

### 2. API Key Authentication  
Used for programmatic access with scoped permissions.

```typescript
// Example: API key with table scope
const context = createPermissionContext({ 
  apiKey: 'dtk_abc123...' 
});
const permission = await checker.getTablePermission(123);
```

### 3. Public Slug Access
Allows anonymous access to shared resources.

```typescript
// Example: Public access via slug
const context = createPermissionContext({ 
  publicSlug: 'demo-public-table' 
});
const canView = await checker.canViewTable(123);
```

## Permission Checking Logic

The system checks permissions in the following order:

1. **Workspace Ownership** - If user owns the workspace, grant full access
2. **API Key Permissions** - Check API key scope and role
3. **Direct Table Shares** - Check if table is directly shared with user/public
4. **Folder Shares** - Check if parent folder is shared with user/public
5. **Default Deny** - If no permissions found, deny access

## API Usage Examples

### Protected API Route

```typescript
import { withAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest, { params }: Params) {
  const tableId = parseInt(params.id);
  
  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'view'
  });
  
  if (!authResult.success) {
    return authResult.response!; // Returns 401/403 error
  }
  
  // User has permission, proceed with request
  const tableData = await getTableData(tableId);
  return NextResponse.json(tableData);
}
```

### Public Access Route

```typescript
// GET /api/public/[slug]
// No authentication required, uses public slug
export async function GET(request: NextRequest, { params }: Params) {
  const publicSlug = params.slug;
  
  // Find public share
  const share = await findPublicShare(publicSlug);
  if (!share) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  // Return read-only data
  return NextResponse.json({ 
    data: publicData,
    permissions: { canView: true, canEdit: false, canManage: false }
  });
}
```

## Database Schema Support

The system works with the existing Drizzle schema:

### Shares Table
```sql
CREATE TABLE shares (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('table', 'folder')),
  target_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'public')),
  email VARCHAR(255), -- NULL for public shares
  public_slug VARCHAR(255) UNIQUE, -- For public access
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### API Keys Table
```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('workspace', 'table')),
  scope_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'owner')),
  token_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP
);
```

## Implementation Examples

### 1. Workspace Owner Access
```typescript
// Workspace owners have full access to all resources
const owner = { userId: 1, email: 'owner@example.com' };
const context = createPermissionContext(owner);
const checker = new PermissionChecker(context);

// Returns: { canView: true, canEdit: true, canManage: true, role: 'owner' }
const permission = await checker.getTablePermission(123);
```

### 2. Shared Table Access
```typescript
// Table shared with editor role
const editor = { userId: 2, email: 'editor@example.com' };
const context = createPermissionContext(editor);
const checker = new PermissionChecker(context);

// Returns: { canView: true, canEdit: true, canManage: false, role: 'editor' }
const permission = await checker.getTablePermission(123);
```

### 3. API Key Access
```typescript
// API key with table scope and editor role
const apiContext = createPermissionContext({ apiKey: 'dtk_abc123...' });
const checker = new PermissionChecker(apiContext);

// Returns permission based on API key scope and role
const permission = await checker.getTablePermission(123);
```

### 4. Public Access
```typescript
// Public access via slug
const publicContext = createPermissionContext({ 
  publicSlug: 'demo-public-table' 
});
const checker = new PermissionChecker(publicContext);

// Returns: { canView: true, canEdit: false, canManage: false, role: 'public' }
const permission = await checker.getTablePermission(123);
```

## Quick Start Testing

Use the demo utilities to test the permission system:

```typescript
import { runAllDemos, PermissionTester } from '@/lib/permissions-demo';

// Run comprehensive demos
await runAllDemos();

// Test specific scenarios
const permission = await PermissionTester.testTableAccess(userId, tableId);
const publicPermission = await PermissionTester.testPublicAccess(slug, tableId);
```

## Security Considerations

1. **API Keys** - Stored as hashes, never in plain text
2. **JWT Tokens** - Signed with secret, configurable expiration
3. **Public Slugs** - Unique, non-guessable identifiers
4. **Permission Inheritance** - Folder permissions apply to contained tables
5. **Default Deny** - No access unless explicitly granted

## Error Handling

The system returns appropriate HTTP status codes:

- **401 Unauthorized** - No valid authentication found
- **403 Forbidden** - Authenticated but insufficient permissions  
- **404 Not Found** - Resource doesn't exist or no access
- **500 Internal Server Error** - System error during permission check

## Performance Notes

- Permissions are checked on each request (stateless)
- Database queries are optimized with indexes
- Consider caching for high-traffic scenarios
- Public access bypasses most permission checks

## Migration Guide

To integrate this permission system into your existing app:

1. Use the existing database schema (already implemented)
2. Import permission utilities: `import { withAuth } from '@/lib/auth-middleware'`
3. Protect API routes with `withAuth()` middleware
4. Use `PermissionChecker` for custom permission logic
5. Test with demo utilities: `runAllDemos()`

This permission system provides enterprise-grade access control while remaining simple to use and maintain.