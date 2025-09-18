import { db } from '@/server/db';
import { users, workspaces, folders, tables, shares, apiKeys } from '@/server/db/schema';
import { PermissionChecker, createPermissionContext } from './permissions';
import { generateAPIKey, hashAPIKey } from './auth-middleware';

/**
 * Demo functions to show how the permission system works
 * This file demonstrates various permission scenarios
 */

// Demo data setup
export async function setupDemoData() {
  console.log('Setting up demo data...');

  // Create demo user
  const demoUsers = await db.insert(users).values([
    { email: 'owner@example.com', name: 'Workspace Owner' },
    { email: 'editor@example.com', name: 'Table Editor' },
    { email: 'viewer@example.com', name: 'Table Viewer' }
  ]).returning();

  const [owner, editor, viewer] = demoUsers;

  // Create demo workspace
  const demoWorkspaces = await db.insert(workspaces).values({
    name: 'Demo Workspace',
    ownerUserId: owner.id
  }).returning();

  const workspace = demoWorkspaces[0];

  // Create demo folder
  const demoFolders = await db.insert(folders).values({
    name: 'Demo Folder',
    workspaceId: workspace.id
  }).returning();

  const folder = demoFolders[0];

  // Create demo table
  const demoTables = await db.insert(tables).values({
    name: 'Demo Table',
    folderId: folder.id
  }).returning();

  const table = demoTables[0];

  // Create shares
  await db.insert(shares).values([
    {
      targetType: 'table',
      targetId: table.id,
      role: 'editor',
      email: editor.email
    },
    {
      targetType: 'table', 
      targetId: table.id,
      role: 'viewer',
      email: viewer.email
    },
    {
      targetType: 'table',
      targetId: table.id,
      role: 'public',
      email: null,
      publicSlug: 'demo-public-table'
    }
  ]);

  // Create API keys
  const apiKey = generateAPIKey();
  const hashedKey = await hashAPIKey(apiKey);

  await db.insert(apiKeys).values({
    name: 'Demo API Key',
    scope: 'table',
    scopeId: table.id,
    role: 'editor',
    tokenHash: hashedKey
  });

  return {
    users: { owner, editor, viewer },
    workspace,
    folder,
    table,
    apiKey
  };
}

/**
 * Demo: Test workspace owner permissions
 */
export async function demoWorkspaceOwner() {
  console.log('\n=== Demo: Workspace Owner Permissions ===');
  
  const data = await setupDemoData();
  const context = createPermissionContext({ 
    userId: data.users.owner.id, 
    email: data.users.owner.email 
  });
  
  const checker = new PermissionChecker(context);
  
  // Test table permissions
  const tablePermission = await checker.getTablePermission(data.table.id);
  console.log('Owner table permissions:', {
    canView: tablePermission.canView,
    canEdit: tablePermission.canEdit,
    canManage: tablePermission.canManage,
    role: tablePermission.role
  });
  
  // Test folder permissions
  const folderPermission = await checker.getFolderPermission(data.folder.id);
  console.log('Owner folder permissions:', {
    canView: folderPermission.canView,
    canEdit: folderPermission.canEdit,
    canManage: folderPermission.canManage,
    role: folderPermission.role
  });
  
  // Test workspace permissions
  const workspacePermission = await checker.getWorkspacePermission(data.workspace.id);
  console.log('Owner workspace permissions:', {
    canView: workspacePermission.canView,
    canEdit: workspacePermission.canEdit,
    canManage: workspacePermission.canManage,
    role: workspacePermission.role
  });
}

/**
 * Demo: Test shared permissions
 */
export async function demoSharedPermissions() {
  console.log('\n=== Demo: Shared Permissions ===');
  
  const data = await setupDemoData();
  
  // Test editor permissions
  const editorContext = createPermissionContext({ 
    userId: data.users.editor.id, 
    email: data.users.editor.email 
  });
  const editorChecker = new PermissionChecker(editorContext);
  const editorPermission = await editorChecker.getTablePermission(data.table.id);
  
  console.log('Editor table permissions:', {
    canView: editorPermission.canView,
    canEdit: editorPermission.canEdit,
    canManage: editorPermission.canManage,
    role: editorPermission.role
  });
  
  // Test viewer permissions
  const viewerContext = createPermissionContext({ 
    userId: data.users.viewer.id, 
    email: data.users.viewer.email 
  });
  const viewerChecker = new PermissionChecker(viewerContext);
  const viewerPermission = await viewerChecker.getTablePermission(data.table.id);
  
  console.log('Viewer table permissions:', {
    canView: viewerPermission.canView,
    canEdit: viewerPermission.canEdit,
    canManage: viewerPermission.canManage,
    role: viewerPermission.role
  });
}

/**
 * Demo: Test API key permissions
 */
export async function demoAPIKeyPermissions() {
  console.log('\n=== Demo: API Key Permissions ===');
  
  const data = await setupDemoData();
  const context = createPermissionContext({ apiKey: data.apiKey });
  
  const checker = new PermissionChecker(context);
  const permission = await checker.getTablePermission(data.table.id);
  
  console.log('API Key table permissions:', {
    canView: permission.canView,
    canEdit: permission.canEdit,
    canManage: permission.canManage,
    role: permission.role
  });
}

/**
 * Demo: Test public access
 */
export async function demoPublicAccess() {
  console.log('\n=== Demo: Public Access ===');
  
  const data = await setupDemoData();
  const context = createPermissionContext({ publicSlug: 'demo-public-table' });
  
  const checker = new PermissionChecker(context);
  const permission = await checker.getTablePermission(data.table.id);
  
  console.log('Public table permissions:', {
    canView: permission.canView,
    canEdit: permission.canEdit,
    canManage: permission.canManage,
    role: permission.role
  });
}

/**
 * Demo: Test unauthorized access
 */
export async function demoUnauthorizedAccess() {
  console.log('\n=== Demo: Unauthorized Access ===');
  
  const data = await setupDemoData();
  const context = createPermissionContext({ userId: 999, email: 'unauthorized@example.com' });
  
  const checker = new PermissionChecker(context);
  const permission = await checker.getTablePermission(data.table.id);
  
  console.log('Unauthorized table permissions:', {
    canView: permission.canView,
    canEdit: permission.canEdit,
    canManage: permission.canManage,
    role: permission.role
  });
}

/**
 * Run all permission demos
 */
export async function runAllDemos() {
  console.log('🔒 Running Permission System Demos');
  console.log('=====================================');
  
  try {
    await demoWorkspaceOwner();
    await demoSharedPermissions(); 
    await demoAPIKeyPermissions();
    await demoPublicAccess();
    await demoUnauthorizedAccess();
    
    console.log('\n✅ All demos completed successfully!');
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

/**
 * Permission testing utilities
 */
export class PermissionTester {
  static async testTableAccess(userId: number, tableId: number) {
    const context = createPermissionContext({ userId });
    const checker = new PermissionChecker(context);
    return await checker.getTablePermission(tableId);
  }
  
  static async testFolderAccess(userId: number, folderId: number) {
    const context = createPermissionContext({ userId });
    const checker = new PermissionChecker(context);
    return await checker.getFolderPermission(folderId);
  }
  
  static async testPublicAccess(publicSlug: string, tableId: number) {
    const context = createPermissionContext({ publicSlug });
    const checker = new PermissionChecker(context);
    return await checker.getTablePermission(tableId);
  }
  
  static async testAPIKeyAccess(apiKey: string, tableId: number) {
    const context = createPermissionContext({ apiKey });
    const checker = new PermissionChecker(context);
    return await checker.getTablePermission(tableId);
  }
}