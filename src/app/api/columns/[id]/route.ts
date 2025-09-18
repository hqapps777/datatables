import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/server/db';
import { columns, tables, cells } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { AuditLogger } from '@/lib/audit-logger';
import { UpdateColumnRequest, ApiResponse } from '@/lib/types';
import { validateColumnType } from '@/lib/query-helpers';
import { updateColumnSchema, handleApiError, NotFoundError, ConflictError } from '@/lib/validation';

interface Params {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/columns/[id] - Update a column
 * Requires: edit permission on table
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const columnId = parseInt(resolvedParams.id);

  if (isNaN(columnId)) {
    return NextResponse.json({ error: 'Invalid column ID' }, { status: 400 });
  }

  try {
    // Get column to find table ID
    const column = await db
      .select()
      .from(columns)
      .where(eq(columns.id, columnId))
      .limit(1);

    if (!column[0]) {
      throw new NotFoundError('Column not found');
    }

    const tableId = column[0].tableId;

    // Authenticate and authorize
    const authResult = await withAuth(request, {
      tableId,
      requiredPermission: 'edit'
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = updateColumnSchema.safeParse(body);
    if (!validationResult.success) {
      const errorResponse = handleApiError(validationResult.error);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const { name, type, config, position } = validationResult.data;

    // Check if new name conflicts with existing columns (if name is being changed)
    if (name && name !== column[0].name) {
      const existingColumn = await db
        .select()
        .from(columns)
        .where(and(
          eq(columns.tableId, tableId),
          eq(columns.name, name)
        ))
        .limit(1);

      if (existingColumn[0]) {
        throw new ConflictError('Column name already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (config !== undefined) updateData.configJson = config ? JSON.stringify(config) : null;
    if (position !== undefined) updateData.position = position;

    // Update the column
    const updatedColumn = await db
      .update(columns)
      .set(updateData)
      .where(eq(columns.id, columnId))
      .returning();

    // Log the audit entry
    if (authResult.context?.permissionContext.userId) {
      await AuditLogger.logColumnUpdate(
        {
          userId: authResult.context.permissionContext.userId,
          tableId,
        },
        {
          id: column[0].id,
          name: column[0].name,
          type: column[0].type,
          config: column[0].configJson ? JSON.parse(column[0].configJson) : null,
          position: column[0].position,
        },
        {
          id: updatedColumn[0].id,
          name: updatedColumn[0].name,
          type: updatedColumn[0].type,
          config: updatedColumn[0].configJson ? JSON.parse(updatedColumn[0].configJson) : null,
          position: updatedColumn[0].position,
        }
      );
    }

    const response: ApiResponse = {
      data: {
        id: updatedColumn[0].id,
        name: updatedColumn[0].name,
        type: updatedColumn[0].type,
        config: updatedColumn[0].configJson ? JSON.parse(updatedColumn[0].configJson) : null,
        position: updatedColumn[0].position,
        isComputed: updatedColumn[0].isComputed,
        formula: updatedColumn[0].formula,
      },
      message: 'Column updated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

/**
 * DELETE /api/columns/[id] - Delete a column
 * Requires: edit permission on table
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const columnId = parseInt(resolvedParams.id);

  if (isNaN(columnId)) {
    return NextResponse.json({ error: 'Invalid column ID' }, { status: 400 });
  }

  try {
    // Get column to find table ID
    const column = await db
      .select()
      .from(columns)
      .where(eq(columns.id, columnId))
      .limit(1);

    if (!column[0]) {
      throw new NotFoundError('Column not found');
    }

    const tableId = column[0].tableId;

    // Authenticate and authorize
    const authResult = await withAuth(request, {
      tableId,
      requiredPermission: 'edit'
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    // Delete all cells associated with this column first
    await db
      .delete(cells)
      .where(eq(cells.columnId, columnId));

    // Delete the column
    await db
      .delete(columns)
      .where(eq(columns.id, columnId));

    // Log the audit entry
    if (authResult.context?.permissionContext.userId) {
      await AuditLogger.logColumnDelete(
        {
          userId: authResult.context.permissionContext.userId,
          tableId,
        },
        {
          id: column[0].id,
          name: column[0].name,
          type: column[0].type,
          config: column[0].configJson ? JSON.parse(column[0].configJson) : null,
          position: column[0].position,
        }
      );
    }

    const response: ApiResponse = {
      message: 'Column deleted successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}