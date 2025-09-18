import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { folders, tables, workspaces } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';

interface Params {
  params: {
    id: string;
  };
}

/**
 * GET /api/folders/[id] - View folder contents
 * Requires: view permission on folder
 * Supports: JWT, API key, public slug access
 */
export async function GET(request: NextRequest, { params }: Params) {
  const folderId = parseInt(params.id);

  if (isNaN(folderId)) {
    return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    folderId,
    requiredPermission: 'view'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    // Get folder info with workspace details
    const folderInfo = await db
      .select({
        id: folders.id,
        name: folders.name,
        createdAt: folders.createdAt,
        workspaceId: folders.workspaceId,
        workspaceName: workspaces.name,
        parentFolderId: folders.parentFolderId,
      })
      .from(folders)
      .innerJoin(workspaces, eq(folders.workspaceId, workspaces.id))
      .where(eq(folders.id, folderId))
      .limit(1);

    if (!folderInfo[0]) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Get subfolder count
    const subfolders = await db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.parentFolderId, folderId));

    // Get tables in this folder
    const folderTables = await db
      .select({
        id: tables.id,
        name: tables.name,
        createdAt: tables.createdAt,
        updatedAt: tables.updatedAt,
        isArchived: tables.isArchived,
      })
      .from(tables)
      .where(eq(tables.folderId, folderId))
      .orderBy(tables.name);

    return NextResponse.json({
      folder: folderInfo[0],
      tables: folderTables,
      metadata: {
        totalTables: folderTables.length,
        totalSubfolders: subfolders.length,
        permissions: {
          canView: true,
          canEdit: authResult.context!.user ? true : false, // Simplified check
          canManage: authResult.context!.user ? true : false, // Simplified check
        }
      }
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/folders/[id] - Update folder
 * Requires: edit permission on folder
 * Supports: JWT, API key (not public access)
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const folderId = parseInt(params.id);

  if (isNaN(folderId)) {
    return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    folderId,
    requiredPermission: 'edit'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    const body = await request.json();
    const { name, parentFolderId } = body;

    // Update folder
    const updatedFolder = await db
      .update(folders)
      .set({
        name,
        parentFolderId,
      })
      .where(eq(folders.id, folderId))
      .returning();

    if (!updatedFolder[0]) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    return NextResponse.json({
      folder: updatedFolder[0],
      message: 'Folder updated successfully'
    });
  } catch (error) {
    console.error('Error updating folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/folders/[id] - Delete folder
 * Requires: manage permission on folder
 * Supports: JWT only (workspace owners)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const folderId = parseInt(params.id);

  if (isNaN(folderId)) {
    return NextResponse.json({ error: 'Invalid folder ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    folderId,
    requiredPermission: 'manage'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    // Check if folder exists
    const folder = await db
      .select()
      .from(folders)
      .where(eq(folders.id, folderId))
      .limit(1);

    if (!folder[0]) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Check if folder has tables or subfolders
    const folderTables = await db
      .select({ id: tables.id })
      .from(tables)
      .where(eq(tables.folderId, folderId));

    const subfolders = await db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.parentFolderId, folderId));

    if (folderTables.length > 0 || subfolders.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete folder with tables or subfolders' 
      }, { status: 400 });
    }

    // Delete folder
    await db.delete(folders).where(eq(folders.id, folderId));

    return NextResponse.json({
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}