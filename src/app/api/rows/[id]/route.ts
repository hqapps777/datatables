import { NextRequest, NextResponse } from 'next/server';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/server/db';
import { rows, tables, columns, cells } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { AuditLogger } from '@/lib/audit-logger';
import { UpdateRowRequest, ApiResponse } from '@/lib/types';
import { updateRowSchema, handleApiError, NotFoundError, ValidationError, validateCellValue } from '@/lib/validation';
import { FormulaIntegration } from '@/lib/formula/integration';
import { ComputedColumnsService } from '@/lib/formula/computed-columns';

interface Params {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/rows/[id] - Update a row
 * Requires: edit permission on table
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const rowId = parseInt(resolvedParams.id);

  if (isNaN(rowId)) {
    return NextResponse.json({ error: 'Invalid row ID' }, { status: 400 });
  }

  try {
    // Get row to find table ID
    const row = await db
      .select()
      .from(rows)
      .where(eq(rows.id, rowId))
      .limit(1);

    if (!row[0]) {
      throw new NotFoundError('Row not found');
    }

    const tableId = row[0].tableId;

    // Authenticate and authorize
    const authResult = await withAuth(request, {
      tableId,
      requiredPermission: 'edit'
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    // Get table columns for validation
    const tableColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    const columnMap = new Map(tableColumns.map(col => [col.name, col]));

    // Get current cell data for audit logging
    const currentCells = await db
      .select()
      .from(cells)
      .where(eq(cells.rowId, rowId));

    const currentData: Record<string, any> = {};
    for (const cell of currentCells) {
      const column = tableColumns.find(col => col.id === cell.columnId);
      if (column) {
        currentData[column.name] = cell.valueJson ? JSON.parse(cell.valueJson) : null;
      }
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = updateRowSchema.safeParse(body);
    if (!validationResult.success) {
      const errorResponse = handleApiError(validationResult.error);
      return NextResponse.json(errorResponse, { status: errorResponse.status });
    }

    const { data, formulas } = validationResult.data;

    // Prepare batch updates for formula processing
    const cellUpdates: Array<{
      rowId: number;
      columnId: number;
      value: any;
      formula?: string;
    }> = [];

    // Validate cell values and prepare updates
    for (const [columnName, value] of Object.entries(data)) {
      const column = columnMap.get(columnName);
      if (column) {
        const config = column.configJson ? JSON.parse(column.configJson) : null;
        
        // Check if this is a formula (starts with =) or if we have a separate formula
        const cellFormula = formulas?.[columnName] || (typeof value === 'string' && value.startsWith('=') ? value : undefined);
        const cellValue = cellFormula ? null : value; // If formula, don't use value directly
        
        if (!cellFormula) {
          // Validate non-formula values
          const validation = validateCellValue(cellValue, column.type, config);
          if (!validation.isValid) {
            throw new ValidationError(`Invalid value for column '${columnName}': ${validation.error}`, columnName);
          }
        }

        cellUpdates.push({
          rowId,
          columnId: column.id,
          value: cellValue,
          formula: cellFormula,
        });
      }
    }

    // Update row timestamp
    await db
      .update(rows)
      .set({ updatedAt: new Date() })
      .where(eq(rows.id, rowId));

    // Process all cell updates with formula integration
    const formulaResult = await FormulaIntegration.updateMultipleCells(tableId, cellUpdates);

    // Update database with processed values
    for (const result of formulaResult.results) {
      // Check if cell exists
      const existingCell = await db
        .select()
        .from(cells)
        .where(and(
          eq(cells.rowId, result.rowId),
          eq(cells.columnId, result.columnId)
        ))
        .limit(1);

      const valueJson = result.value !== null && result.value !== undefined ? JSON.stringify(result.value) : null;

      if (existingCell[0]) {
        // Update existing cell
        await db
          .update(cells)
          .set({
            valueJson,
            formula: result.formula || null,
            errorCode: result.error || null,
            calcVersion: existingCell[0].calcVersion + 1,
          })
          .where(eq(cells.id, existingCell[0].id));
      } else {
        // Create new cell
        await db
          .insert(cells)
          .values({
            rowId: result.rowId,
            columnId: result.columnId,
            valueJson,
            formula: result.formula || null,
            errorCode: result.error || null,
          });
      }
    }

    // Update affected cells from formula recalculation
    for (const affectedCell of formulaResult.affectedCells) {
      const existingCell = await db
        .select()
        .from(cells)
        .where(and(
          eq(cells.rowId, affectedCell.rowId),
          eq(cells.columnId, affectedCell.columnId)
        ))
        .limit(1);

      if (existingCell[0]) {
        await db
          .update(cells)
          .set({
            valueJson: affectedCell.value !== null ? JSON.stringify(affectedCell.value) : null,
            errorCode: affectedCell.error || null,
            calcVersion: existingCell[0].calcVersion + 1,
          })
          .where(eq(cells.id, existingCell[0].id));
      }
    }

    // Propagate changes to computed columns that depend on the changed columns
    const changedColumnIds = cellUpdates.map(update => update.columnId);
    let propagationResults;
    
    if (changedColumnIds.length > 0) {
      // For each changed column, check if computed columns depend on it
      const allPropagationResults = [];
      
      for (const changedColumnId of changedColumnIds) {
        try {
          const result = await ComputedColumnsService.propagateColumnChanges(
            tableId,
            changedColumnId,
            [rowId] // Only recalculate for this specific row
          );
          allPropagationResults.push(result);
        } catch (error) {
          console.error(`Error propagating changes for column ${changedColumnId}:`, error);
        }
      }
      
      // Aggregate results
      propagationResults = {
        totalAffectedComputedColumns: allPropagationResults.reduce((sum, r) => sum + r.affectedComputedColumns, 0),
        totalRecalculatedCells: allPropagationResults.reduce((sum, r) => sum + r.recalculatedCells, 0),
        allErrors: allPropagationResults.flatMap(r => r.errors),
      };
    }

    // Get updated row data
    const updatedCells = await db
      .select()
      .from(cells)
      .where(eq(cells.rowId, rowId));

    const updatedData: Record<string, any> = {};
    for (const cell of updatedCells) {
      const column = tableColumns.find(col => col.id === cell.columnId);
      if (column) {
        updatedData[column.name] = cell.valueJson ? JSON.parse(cell.valueJson) : null;
      }
    }

    // Log audit entry
    if (authResult.context?.permissionContext.userId) {
      await AuditLogger.logRowUpdate(
        {
          userId: authResult.context.permissionContext.userId,
          tableId,
          rowId,
        },
        currentData,
        updatedData
      );
    }

    // Get updated row info
    const updatedRow = await db
      .select()
      .from(rows)
      .where(eq(rows.id, rowId))
      .limit(1);

    const response: ApiResponse = {
      data: {
        id: rowId,
        createdAt: updatedRow[0].createdAt,
        updatedAt: updatedRow[0].updatedAt,
        data: updatedData,
        propagation: propagationResults && propagationResults.totalRecalculatedCells > 0 ? {
          affectedComputedColumns: propagationResults.totalAffectedComputedColumns,
          recalculatedCells: propagationResults.totalRecalculatedCells,
          errors: propagationResults.allErrors,
        } : undefined,
      },
      message: propagationResults && propagationResults.totalRecalculatedCells > 0
        ? 'Row updated and computed columns recalculated successfully'
        : 'Row updated successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating row:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/rows/[id] - Delete a row
 * Requires: edit permission on table
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const rowId = parseInt(resolvedParams.id);

  if (isNaN(rowId)) {
    return NextResponse.json({ error: 'Invalid row ID' }, { status: 400 });
  }

  try {
    // Get row to find table ID
    const row = await db
      .select()
      .from(rows)
      .where(eq(rows.id, rowId))
      .limit(1);

    if (!row[0]) {
      throw new NotFoundError('Row not found');
    }

    const tableId = row[0].tableId;

    // Authenticate and authorize
    const authResult = await withAuth(request, {
      tableId,
      requiredPermission: 'edit'
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    // Get current row data for audit logging
    const tableColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    const currentCells = await db
      .select()
      .from(cells)
      .where(eq(cells.rowId, rowId));

    const currentData: Record<string, any> = {};
    for (const cell of currentCells) {
      const column = tableColumns.find(col => col.id === cell.columnId);
      if (column) {
        currentData[column.name] = cell.valueJson ? JSON.parse(cell.valueJson) : null;
      }
    }

    // Delete all cells associated with this row
    await db
      .delete(cells)
      .where(eq(cells.rowId, rowId));

    // Soft delete the row (mark as deleted)
    await db
      .update(rows)
      .set({ 
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rows.id, rowId));

    // Log audit entry
    if (authResult.context?.permissionContext.userId) {
      await AuditLogger.logRowDelete(
        {
          userId: authResult.context.permissionContext.userId,
          tableId,
          rowId,
        },
        {
          rowId,
          data: currentData,
          deletedAt: new Date(),
        }
      );
    }

    const response: ApiResponse = {
      message: 'Row deleted successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error deleting row:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}