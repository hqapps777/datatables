import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { cells, rows, columns, tables } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { AuditLogger } from '@/lib/audit-logger';
import { FormulaEngine } from '@/lib/formula/engine';
import { handleApiError, NotFoundError, ValidationError } from '@/lib/validation';
import { ApiResponse } from '@/lib/types';

interface Params {
  params: {
    id: string;
  };
}

/**
 * Error code mapping from HyperFormula to standardized codes
 */
class ErrorCodeMapper {
  static mapHyperFormulaError(hfError: any): string | null {
    if (!hfError || typeof hfError !== 'object') return null;
    
    // HyperFormula error types
    const errorType = hfError.type || hfError.error;
    
    switch (errorType) {
      case 'DIV_BY_ZERO':
      case '#DIV/0!':
        return '#DIV/0!';
        
      case 'REF_ERROR':
      case '#REF!':
        return '#REF!';
        
      case 'NAME_ERROR':
      case '#NAME?':
        return '#NAME?';
        
      case 'VALUE_ERROR': 
      case '#VALUE!':
        return '#VALUE!';
        
      case 'CYCLE_ERROR':
      case '#CYCLE!':
        return '#CYCLE!';
        
      case 'NUM_ERROR':
      case '#NUM!':
        return '#NUM!';
        
      case 'NULL_ERROR':
      case '#NULL!':
        return '#NULL!';
        
      case 'ERROR':
      case '#ERROR!':
        return '#ERROR!';
        
      default:
        // For string errors or unknown types
        if (typeof errorType === 'string') {
          if (errorType.startsWith('#') && errorType.endsWith('!')) {
            return errorType; // Already a standard error code
          }
        }
        return '#ERROR!'; // Generic error fallback
    }
  }
}

/**
 * PATCH /api/cells/[id] - Update a specific cell with value or formula
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const cellId = parseInt(resolvedParams.id);

  if (isNaN(cellId)) {
    return NextResponse.json({ error: 'Invalid cell ID' }, { status: 400 });
  }

  try {
    // Get cell and related table info
    const cellInfo = await db
      .select({
        cellId: cells.id,
        rowId: cells.rowId,
        columnId: cells.columnId,
        currentValueJson: cells.valueJson,
        currentFormula: cells.formula,
        currentError: cells.errorCode,
        tableId: rows.tableId,
      })
      .from(cells)
      .innerJoin(rows, eq(cells.rowId, rows.id))
      .where(eq(cells.id, cellId))
      .limit(1);

    if (!cellInfo[0]) {
      throw new NotFoundError('Cell not found');
    }

    const cell = cellInfo[0];

    // Authenticate and authorize
    const authResult = await withAuth(request, {
      tableId: cell.tableId,
      requiredPermission: 'edit'
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    const body = await request.json();
    const { value_json, formula } = body;

    // Validate that either value_json or formula is provided, but not both
    // Exception: formula can be null to clear a formula
    if (value_json !== undefined && formula !== undefined && formula !== null) {
      throw new ValidationError('Provide either value_json or formula, not both');
    }

    if (value_json === undefined && formula === undefined) {
      throw new ValidationError('Either value_json or formula must be provided');
    }

    let finalValue: any = null;
    let finalFormula: string | null = null;
    let errorCode: string | null = null;
    const updatedCells: Array<{ id: number; value: any; error: string | null }> = [];

    if (formula !== undefined) {
      // Formula provided - validate and evaluate
      if (formula !== null && !formula.startsWith('=')) {
        throw new ValidationError('Formula must start with =');
      }

      // Get formula engine and cell mapper
      const engine = await FormulaEngine.getInstance(cell.tableId);
      const cellMapper = engine.getCellMapper();
      
      // Convert to A1 notation
      const a1Ref = cellMapper.cellToA1(cell.rowId, cell.columnId);
      if (!a1Ref) {
        throw new ValidationError('Could not convert cell coordinates to A1 notation');
      }

      // Validate formula syntax (skip validation for null - formula clearing)
      if (formula !== null) {
        const validation = engine.validateFormula(formula);
        if (!validation.isValid) {
          throw new ValidationError(`Invalid formula: ${validation.error}`);
        }
      }

      if (formula !== null) {
        // Set formula in engine and evaluate
        await engine.setCellFormula(a1Ref, formula);
        const evaluation = await engine.evaluateCell(a1Ref);
        
        finalValue = evaluation.value;
        finalFormula = formula;
        errorCode = evaluation.error ? ErrorCodeMapper.mapHyperFormulaError(evaluation.error) : null;
      } else {
        // Clear formula - set to null/empty
        await engine.setCellValue(a1Ref, null);
        finalValue = null;
        finalFormula = null;
        errorCode = null;
      }

      // Get affected cells from recalculation
      const recalcResult = await engine.recalcAffected([a1Ref]);
      
      // Map affected cells back to database IDs
      for (const affectedCell of recalcResult.affectedCells) {
        const coords = cellMapper.a1ToCell(affectedCell.a1);
        if (coords) {
          // Find the cell ID for these coordinates
          const affectedCellInfo = await db
            .select({ id: cells.id })
            .from(cells)
            .where(and(
              eq(cells.rowId, coords.rowId),
              eq(cells.columnId, coords.columnId)
            ))
            .limit(1);

          if (affectedCellInfo[0]) {
            updatedCells.push({
              id: affectedCellInfo[0].id,
              value: affectedCell.value,
              error: affectedCell.error ? ErrorCodeMapper.mapHyperFormulaError(affectedCell.error) : null,
            });

            // Update affected cell in database
            await db
              .update(cells)
              .set({
                valueJson: affectedCell.value !== null ? JSON.stringify(affectedCell.value) : null,
                errorCode: affectedCell.error ? ErrorCodeMapper.mapHyperFormulaError(affectedCell.error) : null,
                calcVersion: sql`calc_version + 1`,
              })
              .where(eq(cells.id, affectedCellInfo[0].id));
          }
        }
      }

    } else {
      // Direct value provided - clear any existing formula
      finalValue = value_json;
      finalFormula = null;
      errorCode = null;

      // If there was a formula before, we need to update the formula engine
      if (cell.currentFormula) {
        const engine = await FormulaEngine.getInstance(cell.tableId);
        const cellMapper = engine.getCellMapper();
        const a1Ref = cellMapper.cellToA1(cell.rowId, cell.columnId);
        
        if (a1Ref) {
          // Set direct value in engine (overwrites formula)
          await engine.setCellValue(a1Ref, finalValue);
          
          // Recalculate affected cells
          const recalcResult = await engine.recalcAffected([a1Ref]);
          
          // Process affected cells same as above
          for (const affectedCell of recalcResult.affectedCells) {
            const coords = cellMapper.a1ToCell(affectedCell.a1);
            if (coords) {
              const affectedCellInfo = await db
                .select({ id: cells.id })
                .from(cells)
                .where(and(
                  eq(cells.rowId, coords.rowId),
                  eq(cells.columnId, coords.columnId)
                ))
                .limit(1);

              if (affectedCellInfo[0]) {
                updatedCells.push({
                  id: affectedCellInfo[0].id,
                  value: affectedCell.value,
                  error: affectedCell.error ? ErrorCodeMapper.mapHyperFormulaError(affectedCell.error) : null,
                });

                await db
                  .update(cells)
                  .set({
                    valueJson: affectedCell.value !== null ? JSON.stringify(affectedCell.value) : null,
                    errorCode: affectedCell.error ? ErrorCodeMapper.mapHyperFormulaError(affectedCell.error) : null,
                    calcVersion: sql`calc_version + 1`,
                  })
                  .where(eq(cells.id, affectedCellInfo[0].id));
              }
            }
          }
        }
      }
    }

    // Update the target cell in database
    const updatedCell = await db
      .update(cells)
      .set({
        valueJson: finalValue !== null ? JSON.stringify(finalValue) : null,
        formula: finalFormula,
        errorCode: errorCode,
        calcVersion: sql`calc_version + 1`,
      })
      .where(eq(cells.id, cellId))
      .returning();

    // Log audit entry
    if (authResult.context?.permissionContext.userId) {
      await AuditLogger.log(
        {
          userId: authResult.context.permissionContext.userId,
          tableId: cell.tableId,
          rowId: cell.rowId,
        },
        'cell_update',
        {
          before: {
            value: cell.currentValueJson ? JSON.parse(cell.currentValueJson) : null,
            formula: cell.currentFormula,
            error: cell.currentError,
            cellId: cellId,
          },
          after: {
            value: finalValue,
            formula: finalFormula,
            error: errorCode,
            cellId: cellId,
          },
        }
      );
    }

    const response: ApiResponse = {
      data: {
        id: cellId,
        value: finalValue,
        formula: finalFormula,
        error: errorCode,
        calcVersion: updatedCell[0].calcVersion,
        updatedCells, // Other cells affected by recalculation
      },
      message: finalFormula ? 'Formula set and evaluated successfully' : 'Cell value updated successfully',
    };

    return NextResponse.json(response);

  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

/**
 * GET /api/cells/[id] - Get a specific cell
 */
export async function GET(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const cellId = parseInt(resolvedParams.id);

  if (isNaN(cellId)) {
    return NextResponse.json({ error: 'Invalid cell ID' }, { status: 400 });
  }

  try {
    // Get cell and related info
    const cellInfo = await db
      .select({
        cellId: cells.id,
        rowId: cells.rowId,
        columnId: cells.columnId,
        valueJson: cells.valueJson,
        formula: cells.formula,
        errorCode: cells.errorCode,
        calcVersion: cells.calcVersion,
        tableId: rows.tableId,
        columnName: columns.name,
        columnType: columns.type,
      })
      .from(cells)
      .innerJoin(rows, eq(cells.rowId, rows.id))
      .innerJoin(columns, eq(cells.columnId, columns.id))
      .where(eq(cells.id, cellId))
      .limit(1);

    if (!cellInfo[0]) {
      throw new NotFoundError('Cell not found');
    }

    const cell = cellInfo[0];

    // Authenticate and authorize
    const authResult = await withAuth(request, {
      tableId: cell.tableId,
      requiredPermission: 'view'
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    const response: ApiResponse = {
      data: {
        id: cell.cellId,
        rowId: cell.rowId,
        columnId: cell.columnId,
        columnName: cell.columnName,
        columnType: cell.columnType,
        value: cell.valueJson ? JSON.parse(cell.valueJson) : null,
        formula: cell.formula,
        error: cell.errorCode,
        calcVersion: cell.calcVersion,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}