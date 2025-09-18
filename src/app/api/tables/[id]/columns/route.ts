import { NextRequest, NextResponse } from 'next/server';
import { eq, and, max } from 'drizzle-orm';
import { db } from '@/server/db';
import { tables, columns } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { AuditLogger } from '@/lib/audit-logger';
import { CreateColumnRequest, ApiResponse } from '@/lib/types';
import { validateColumnType } from '@/lib/query-helpers';
import { createColumnSchema, handleApiError, NotFoundError, ConflictError } from '@/lib/validation';

interface Params {
  params: {
    id: string;
  };
}

/**
 * GET /api/tables/[id]/columns - Get all columns for a table
 * Requires: view permission on table
 */
export async function GET(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const tableId = parseInt(resolvedParams.id);

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
    // Verify table exists
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      throw new NotFoundError('Table not found');
    }

    // Get all columns for the table
    const tableColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    const response: ApiResponse = {
      data: tableColumns.map(col => ({
        id: col.id,
        name: col.name,
        type: col.type,
        config: col.configJson ? JSON.parse(col.configJson) : null,
        position: col.position,
        isComputed: col.isComputed,
        formula: col.formula,
      })),
      metadata: {
        total: tableColumns.length,
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

/**
 * POST /api/tables/[id]/columns - Create a new column
 * Requires: edit permission on table
 */
export async function POST(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const tableId = parseInt(resolvedParams.id);

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
    
    // Validate request body
    const validationResult = createColumnSchema.safeParse(body);
    if (!validationResult.success) {
      const errorResponse = handleApiError(validationResult.error);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const { name, type, config, position } = validationResult.data;

    // Verify table exists
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      throw new NotFoundError('Table not found');
    }

    // Check if column name already exists in this table
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

    // Determine position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const maxPositionResult = await db
        .select({ maxPosition: max(columns.position) })
        .from(columns)
        .where(eq(columns.tableId, tableId));
      
      finalPosition = (maxPositionResult[0]?.maxPosition || 0) + 1;
    }

    // Create the column
    const newColumn = await db
      .insert(columns)
      .values({
        tableId,
        name,
        type,
        configJson: config ? JSON.stringify(config) : null,
        position: finalPosition,
        isComputed: false,
        formula: null,
      })
      .returning();

    // Log the audit entry
    if (authResult.context?.permissionContext.userId) {
      await AuditLogger.logColumnCreate(
        {
          userId: authResult.context.permissionContext.userId,
          tableId,
        },
        {
          columnId: newColumn[0].id,
          name,
          type,
          config,
          position: finalPosition,
        }
      );
    }

    const response: ApiResponse = {
      data: {
        id: newColumn[0].id,
        name: newColumn[0].name,
        type: newColumn[0].type,
        config: newColumn[0].configJson ? JSON.parse(newColumn[0].configJson) : null,
        position: newColumn[0].position,
        isComputed: newColumn[0].isComputed,
        formula: newColumn[0].formula,
      },
      message: 'Column created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}