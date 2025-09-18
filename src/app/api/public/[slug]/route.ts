import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/server/db';
import { tables, shares, folders, columns, rows, cells } from '@/server/db/schema';
import { authenticate } from '@/lib/auth-middleware';

interface Params {
  params: {
    slug: string;
  };
}

/**
 * GET /api/public/[slug] - Public access to shared resources
 * No authentication required - uses public slug for access
 */
export async function GET(request: NextRequest, { params }: Params) {
  const publicSlug = params.slug;

  try {
    // Find the share with this public slug
    const shareResult = await db
      .select()
      .from(shares)
      .where(
        and(
          eq(shares.publicSlug, publicSlug),
          eq(shares.role, 'public')
        )
      )
      .limit(1);

    if (!shareResult[0]) {
      return NextResponse.json({ error: 'Public link not found' }, { status: 404 });
    }

    const share = shareResult[0];

    // Handle table shares
    if (share.targetType === 'table') {
      return await handlePublicTable(share.targetId);
    }

    // Handle folder shares  
    if (share.targetType === 'folder') {
      return await handlePublicFolder(share.targetId);
    }

    return NextResponse.json({ error: 'Invalid share type' }, { status: 400 });
  } catch (error) {
    console.error('Error accessing public resource:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle public table access
 */
async function handlePublicTable(tableId: number) {
  // Get table info
  const table = await db
    .select({
      id: tables.id,
      name: tables.name,
      createdAt: tables.createdAt,
      updatedAt: tables.updatedAt,
      folderName: folders.name,
    })
    .from(tables)
    .innerJoin(folders, eq(tables.folderId, folders.id))
    .where(eq(tables.id, tableId))
    .limit(1);

  if (!table[0]) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
  }

  // Get columns (read-only)
  const tableColumns = await db
    .select({
      id: columns.id,
      name: columns.name,
      type: columns.type,
      position: columns.position,
      isComputed: columns.isComputed,
    })
    .from(columns)
    .where(eq(columns.tableId, tableId))
    .orderBy(columns.position);

  // Get rows (read-only)
  const tableRows = await db
    .select({
      id: rows.id,
      createdAt: rows.createdAt,
      updatedAt: rows.updatedAt,
    })
    .from(rows)
    .where(eq(rows.tableId, tableId))
    .orderBy(rows.updatedAt);

  return NextResponse.json({
    table: table[0],
    columns: tableColumns,
    rows: tableRows,
    metadata: {
      totalRows: tableRows.length,
      totalColumns: tableColumns.length,
      access: 'public',
      permissions: {
        canView: true,
        canEdit: false,
        canManage: false,
      },
    },
  });
}

/**
 * Handle public folder access
 */
async function handlePublicFolder(folderId: number) {
  // Get folder info
  const folder = await db
    .select({
      id: folders.id,
      name: folders.name,
      createdAt: folders.createdAt,
    })
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);

  if (!folder[0]) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  // Get tables in folder (read-only)
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
    folder: folder[0],
    tables: folderTables,
    metadata: {
      totalTables: folderTables.length,
      access: 'public',
      permissions: {
        canView: true,
        canEdit: false,
        canManage: false,
      },
    },
  });
}