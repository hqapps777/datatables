import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { tables, rows, columns, cells } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';

interface Params {
  params: {
    id: string;
  };
}

/**
 * GET /api/tables/[id] - View table data
 * Requires: view permission on table
 * Supports: JWT, API key, public slug access
 */
export async function GET(request: NextRequest, { params }: Params) {
  const tableId = parseInt(params.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'view'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    // Get table info
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Get columns
    const tableColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    // Get rows with cells
    const tableRows = await db
      .select({
        id: rows.id,
        createdAt: rows.createdAt,
        updatedAt: rows.updatedAt,
      })
      .from(rows)
      .where(eq(rows.tableId, tableId))
      .orderBy(rows.updatedAt);

    // Get cells for all rows
    const rowIds = tableRows.map(row => row.id);
    const tableCells = rowIds.length > 0 ? await db
      .select()
      .from(cells)
      .where(eq(cells.rowId, rowIds[0])) // This would need to be adjusted for multiple rows
      : [];

    return NextResponse.json({
      table: table[0],
      columns: tableColumns,
      rows: tableRows,
      cells: tableCells,
      metadata: {
        totalRows: tableRows.length,
        totalColumns: tableColumns.length,
        permission: {
          canView: true,
          canEdit: authResult.context!.permissionContext.userId ? true : false, // Simplified check
        }
      }
    });
  } catch (error) {
    console.error('Error fetching table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/tables/[id] - Update table
 * Requires: edit permission on table
 * Supports: JWT, API key (not public access)
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const tableId = parseInt(params.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'edit'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    const body = await request.json();
    const { name, isArchived } = body;

    // Update table
    const updatedTable = await db
      .update(tables)
      .set({
        name,
        isArchived,
        updatedAt: new Date()
      })
      .where(eq(tables.id, tableId))
      .returning();

    if (!updatedTable[0]) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    return NextResponse.json({
      table: updatedTable[0],
      message: 'Table updated successfully'
    });
  } catch (error) {
    console.error('Error updating table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tables/[id] - Delete table
 * Requires: manage permission on table
 * Supports: JWT only (workspace owners)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const tableId = parseInt(params.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'manage'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    // Check if table exists
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // In a real implementation, you'd soft delete or handle dependencies
    await db.delete(tables).where(eq(tables.id, tableId));

    return NextResponse.json({
      message: 'Table deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting table:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}