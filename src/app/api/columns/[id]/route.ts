import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { columns, tables, cells, rows } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { AuditLogger } from '@/lib/audit-logger';
import { UpdateColumnRequest, ApiResponse } from '@/lib/types';
import { validateColumnType } from '@/lib/query-helpers';
import { updateColumnSchema, handleApiError, NotFoundError, ConflictError } from '@/lib/validation';
import { FormulaEngine, A1NotationMapper } from '@/lib/formula/engine';
import { FormulaIntegration } from '@/lib/formula/integration';
import { ComputedColumnsService } from '@/lib/formula/computed-columns';

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

    const { name, type, config, position, isComputed, formula } = validationResult.data;

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

    // Validate formula if provided or if column is being set to computed
    let formulaValidationResult;
    if (isComputed || formula) {
      const formulaToValidate = formula || column[0].formula;
      if (!formulaToValidate) {
        throw new ConflictError('Formula is required for computed columns');
      }

      // Validate computed column formula with column name references
      formulaValidationResult = await ComputedColumnsService.validateComputedColumnFormula(
        tableId,
        formulaToValidate
      );
      
      if (!formulaValidationResult.isValid) {
        throw new ConflictError(`Invalid formula: ${formulaValidationResult.error}`);
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (config !== undefined) updateData.configJson = config ? JSON.stringify(config) : null;
    if (position !== undefined) updateData.position = position;
    if (isComputed !== undefined) updateData.isComputed = isComputed;
    if (formula !== undefined) updateData.formula = formula;

    // Update the column
    const updatedColumn = await db
      .update(columns)
      .set(updateData)
      .where(eq(columns.id, columnId))
      .returning();

    // If this is now a computed column or formula changed, recalculate all cells in the column
    const shouldRecalculate = (
      (isComputed !== undefined && isComputed) ||
      (formula !== undefined && formula !== column[0].formula) ||
      (updatedColumn[0].isComputed && updatedColumn[0].formula)
    );

    let recalculationResults;
    if (shouldRecalculate && updatedColumn[0].formula) {
      try {
        // Use ComputedColumnsService for proper column name reference handling
        recalculationResults = await ComputedColumnsService.recalculateComputedColumn(
          tableId,
          columnId,
          updatedColumn[0].formula
        );

        // Save computed values to database
        if (recalculationResults.results.length > 0) {
          for (const result of recalculationResults.results) {
            if (!result.error) {
              await db
                .insert(cells)
                .values({
                  rowId: result.rowId,
                  columnId: columnId,
                  valueJson: JSON.stringify(result.value),
                  formula: updatedColumn[0].formula,
                })
                .onConflictDoUpdate({
                  target: [cells.rowId, cells.columnId],
                  set: {
                    valueJson: JSON.stringify(result.value),
                    formula: updatedColumn[0].formula,
                    calcVersion: sql`${cells.calcVersion} + 1`,
                  },
                });
            }
          }
        }
      } catch (error) {
        console.error('Error recalculating column formulas:', error);
        // Continue with column update even if recalculation fails
      }
    }

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
        recalculated: recalculationResults ? {
          affectedRows: recalculationResults.results.length,
          successfulRows: recalculationResults.results.filter(r => !r.error).length,
          errors: recalculationResults.errors,
          success: recalculationResults.success,
        } : undefined,
      },
      message: shouldRecalculate ? 'Column updated and formulas recalculated successfully' : 'Column updated successfully',
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