import { eq, and, or, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { users, workspaces, folders, tables, shares, apiKeys } from '@/server/db/schema';

// Permission types
export type Role = 'owner' | 'editor' | 'viewer' | 'public';
export type ShareTargetType = 'table' | 'folder';
export type ApiKeyScope = 'workspace' | 'table';

// Context types for permission checking
export interface PermissionContext {
  userId?: number;
  email?: string;
  apiKey?: string;
  publicSlug?: string;
}

export interface UserPermission {
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  role: Role;
}

// Permission checking results
export interface TablePermission extends UserPermission {
  tableId: number;
}

export interface FolderPermission extends UserPermission {
  folderId: number;
}

export interface WorkspacePermission extends UserPermission {
  workspaceId: number;
}

// Helper types for database queries
export interface ShareInfo {
  id: number;
  targetType: ShareTargetType;
  targetId: number;
  role: string;
  email: string | null;
  publicSlug: string | null;
}

export interface ApiKeyInfo {
  id: number;
  name: string;
  scope: ApiKeyScope;
  scopeId: number;
  role: string;
  revokedAt: Date | null;
}

// Core permission checking class
export class PermissionChecker {
  constructor(private context: PermissionContext) {}

  /**
   * Check if user can view a specific table
   */
  async canViewTable(tableId: number): Promise<boolean> {
    const permission = await this.getTablePermission(tableId);
    return permission.canView;
  }

  /**
   * Check if user can edit a specific table
   */
  async canEditTable(tableId: number): Promise<boolean> {
    const permission = await this.getTablePermission(tableId);
    return permission.canEdit;
  }

  /**
   * Check if user can manage a specific folder
   */
  async canManageFolder(folderId: number): Promise<boolean> {
    const permission = await this.getFolderPermission(folderId);
    return permission.canManage;
  }

  /**
   * Get detailed table permissions
   */
  async getTablePermission(tableId: number): Promise<TablePermission> {
    // Get table info with workspace ownership
    const tableInfo = await db
      .select({
        tableId: tables.id,
        folderId: tables.folderId,
        workspaceId: folders.workspaceId,
        ownerUserId: workspaces.ownerUserId,
      })
      .from(tables)
      .innerJoin(folders, eq(tables.folderId, folders.id))
      .innerJoin(workspaces, eq(folders.workspaceId, workspaces.id))
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!tableInfo[0]) {
      return this.createPermission(false, false, false, 'viewer', tableId);
    }

    const info = tableInfo[0];

    // Check workspace ownership first
    if (this.context.userId && this.context.userId === info.ownerUserId) {
      return this.createPermission(true, true, true, 'owner', tableId);
    }

    // Check API key permissions
    if (this.context.apiKey) {
      const apiPermission = await this.checkApiKeyPermission(tableId, info.workspaceId);
      if (apiPermission) {
        return { ...apiPermission, tableId };
      }
    }

    // Check share permissions for table
    const tableShare = await this.getSharePermission('table', tableId);
    if (tableShare.canView) {
      return { ...tableShare, tableId };
    }

    // Check share permissions for folder
    const folderShare = await this.getSharePermission('folder', info.folderId);
    if (folderShare.canView) {
      return { ...folderShare, tableId };
    }

    return this.createPermission(false, false, false, 'viewer', tableId);
  }

  /**
   * Get detailed folder permissions
   */
  async getFolderPermission(folderId: number): Promise<FolderPermission> {
    // Get folder info with workspace ownership
    const folderInfo = await db
      .select({
        folderId: folders.id,
        workspaceId: folders.workspaceId,
        ownerUserId: workspaces.ownerUserId,
      })
      .from(folders)
      .innerJoin(workspaces, eq(folders.workspaceId, workspaces.id))
      .where(eq(folders.id, folderId))
      .limit(1);

    if (!folderInfo[0]) {
      return this.createFolderPermission(false, false, false, 'viewer', folderId);
    }

    const info = folderInfo[0];

    // Check workspace ownership
    if (this.context.userId && this.context.userId === info.ownerUserId) {
      return this.createFolderPermission(true, true, true, 'owner', folderId);
    }

    // Check API key permissions
    if (this.context.apiKey) {
      const apiPermission = await this.checkApiKeyPermission(folderId, info.workspaceId);
      if (apiPermission) {
        return { ...apiPermission, folderId };
      }
    }

    // Check share permissions for folder
    const sharePermission = await this.getSharePermission('folder', folderId);
    return { ...sharePermission, folderId };
  }

  /**
   * Get workspace permissions
   */
  async getWorkspacePermission(workspaceId: number): Promise<WorkspacePermission> {
    // Get workspace info
    const workspaceInfo = await db
      .select({
        workspaceId: workspaces.id,
        ownerUserId: workspaces.ownerUserId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspaceInfo[0]) {
      return this.createWorkspacePermission(false, false, false, 'viewer', workspaceId);
    }

    const info = workspaceInfo[0];

    // Check workspace ownership
    if (this.context.userId && this.context.userId === info.ownerUserId) {
      return this.createWorkspacePermission(true, true, true, 'owner', workspaceId);
    }

    // Check API key permissions
    if (this.context.apiKey) {
      const apiPermission = await this.checkApiKeyPermission(null, workspaceId);
      if (apiPermission) {
        return { ...apiPermission, workspaceId };
      }
    }

    return this.createWorkspacePermission(false, false, false, 'viewer', workspaceId);
  }

  /**
   * Check share permissions for a target
   */
  private async getSharePermission(targetType: ShareTargetType, targetId: number): Promise<UserPermission> {
    // If we have a public slug, check for public access
    if (this.context.publicSlug) {
      const publicShares = await db
        .select()
        .from(shares)
        .where(
          and(
            eq(shares.targetType, targetType),
            eq(shares.targetId, targetId),
            eq(shares.publicSlug, this.context.publicSlug),
            eq(shares.role, 'public')
          )
        );

      if (publicShares.length > 0) {
        return this.createPermission(true, false, false, 'public');
      }
    }

    // If we have email or userId, check for direct shares
    if (this.context.email || this.context.userId) {
      const userShares = await db
        .select()
        .from(shares)
        .where(
          and(
            eq(shares.targetType, targetType),
            eq(shares.targetId, targetId),
            this.context.email ? eq(shares.email, this.context.email) : isNull(shares.email)
          )
        );

      for (const share of userShares) {
        const role = share.role as Role;
        const permissions = this.roleToPermissions(role);
        if (permissions.canView) {
          return permissions;
        }
      }
    }

    return this.createPermission(false, false, false, 'viewer');
  }

  /**
   * Check API key permissions
   */
  private async checkApiKeyPermission(resourceId: number | null, workspaceId: number): Promise<UserPermission | null> {
    if (!this.context.apiKey) return null;

    // Hash the API key for comparison (in production, you'd hash this)
    const tokenHash = this.context.apiKey;

    const apiKeyInfo = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.tokenHash, tokenHash),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);

    if (!apiKeyInfo[0]) return null;

    const key = apiKeyInfo[0];

    // Check scope and permissions
    if (key.scope === 'workspace' && key.scopeId === workspaceId) {
      return this.roleToPermissions(key.role as Role);
    }

    if (key.scope === 'table' && resourceId && key.scopeId === resourceId) {
      return this.roleToPermissions(key.role as Role);
    }

    return null;
  }

  /**
   * Convert role to permissions
   */
  private roleToPermissions(role: Role): UserPermission {
    switch (role) {
      case 'owner':
        return this.createPermission(true, true, true, role);
      case 'editor':
        return this.createPermission(true, true, false, role);
      case 'viewer':
        return this.createPermission(true, false, false, role);
      case 'public':
        return this.createPermission(true, false, false, role);
      default:
        return this.createPermission(false, false, false, 'viewer');
    }
  }

  /**
   * Create permission object
   */
  private createPermission(canView: boolean, canEdit: boolean, canManage: boolean, role: Role, tableId?: number): TablePermission {
    const permission: UserPermission = { canView, canEdit, canManage, role };
    return tableId ? { ...permission, tableId } : permission as TablePermission;
  }

  private createFolderPermission(canView: boolean, canEdit: boolean, canManage: boolean, role: Role, folderId: number): FolderPermission {
    return { canView, canEdit, canManage, role, folderId };
  }

  private createWorkspacePermission(canView: boolean, canEdit: boolean, canManage: boolean, role: Role, workspaceId: number): WorkspacePermission {
    return { canView, canEdit, canManage, role, workspaceId };
  }
}

/**
 * Helper functions for quick permission checks
 */
export async function canViewTable(context: PermissionContext, tableId: number): Promise<boolean> {
  const checker = new PermissionChecker(context);
  return await checker.canViewTable(tableId);
}

export async function canEditTable(context: PermissionContext, tableId: number): Promise<boolean> {
  const checker = new PermissionChecker(context);
  return await checker.canEditTable(tableId);
}

export async function canManageFolder(context: PermissionContext, folderId: number): Promise<boolean> {
  const checker = new PermissionChecker(context);
  return await checker.canManageFolder(folderId);
}

/**
 * Create permission context from various auth sources
 */
export function createPermissionContext(params: {
  userId?: number;
  email?: string;
  apiKey?: string;
  publicSlug?: string;
}): PermissionContext {
  return {
    userId: params.userId,
    email: params.email,
    apiKey: params.apiKey,
    publicSlug: params.publicSlug,
  };
}