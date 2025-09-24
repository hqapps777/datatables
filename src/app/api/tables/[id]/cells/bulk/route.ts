import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, inArray } from 'drizzle-orm';
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
 * Bulk Cell Update Interface
 */
interface BulkCellUpdate {
  cells: Array<{
    rowId: number;
    columnId: number;
    value: any;
    formula?: string;
  }>;
  options: {
    skipFormulaRecalc?: boolean;
    chunkId?: string;
    isLastChunk?: boolean;
  };
}

interface BulkUpdateResponse {
  success: boolean;
  updatedCount: number;
  errors: Array<{
    rowId: number;
    columnId: number;
    error: string;
  }>;
  affectedCells?: Array<{
    id: number;
    value: any;
    error?: string;
  }>;
  performance?: {
    processingTimeMs: number;
    cellsPerSecond: number;
  };
}

/**
 * Error code mapping from HyperFormula to standardized codes
 */
class ErrorCodeMapper {
  static mapHyperFormulaError(hfError: any): string | null {
    if (!hfError || typeof hfError !== 'object') return null;
    
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
        if (typeof errorType === 'string' && errorType.startsWith('#') && errorType.endsWith('!')) {
          return errorType;
        }
        return '#ERROR!';
    }
  }
}

/**
 * POST /api/tables/[id]/cells/bulk - Bulk update multiple cells
 * Optimized for performance with chunked processing and batch SQL operations
 */
export async function POST(request: NextRequest, { params }: Params) {
  const startTime = Date.now();
  const resolvedParams = await params;
  const tableId = parseInt(resolvedParams.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  try {
    const body: BulkCellUpdate = await request.json();
    const { cells: cellUpdates, options } = body;

    // Validate input
    if (!Array.isArray(cellUpdates) || cellUpdates.length === 0) {
      throw new ValidationError('cells array is required and must not be empty');
    }

    // ⚡ PERFORMANCE OPTIMIZED: Increased bulk update limit for better throughput
    if (cellUpdates.length > 1500) {
      throw new ValidationError('Maximum 1500 cells per bulk update');
    }

    // Validate cell updates
    for (const cell of cellUpdates) {
      if (!cell.rowId || !cell.columnId) {
        throw new ValidationError('Each cell must have rowId and columnId');
      }
      if (cell.formula && !cell.formula.startsWith('=')) {
        throw new ValidationError('Formula must start with =');
      }
    }

    // Authenticate and authorize
    const authResult = await withAuth(request, {
      tableId,
      requiredPermission: 'edit'
    });

    if (!authResult.success) {
      return authResult.response!;
    }

    const errors: Array<{ rowId: number; columnId: number; error: string }> = [];
    const updatedCells: Array<{ id: number; value: any; error: string | null }> = [];
    let updatedCount = 0;

    // Get all cell IDs that need to be updated
    const cellCoordinates = cellUpdates.map(cell => ({
      rowId: cell.rowId,
      columnId: cell.columnId
    }));

    // Fetch existing cells in batch
    const existingCells = await db
      .select({
        id: cells.id,
        rowId: cells.rowId,
        columnId: cells.columnId,
        currentValueJson: cells.valueJson,
        currentFormula: cells.formula,
      })
      .from(cells)
      .where(
        inArray(
          sql`(${cells.rowId}, ${cells.columnId})`,
          cellCoordinates.map(coord => sql`(${coord.rowId}, ${coord.columnId})`)
        )
      );

    // Create a map for quick lookup
    const cellMap = new Map(
      existingCells.map(cell => [
        `${cell.rowId}-${cell.columnId}`,
        cell
      ])
    );

    // Initialize formula engine if needed
    let formulaEngine: any = null;
    const formulaUpdates: Array<{ a1Ref: string; formula: string | null; value: any }> = [];
    
    if (cellUpdates.some(cell => cell.formula !== undefined) || !options.skipFormulaRecalc) {
      formulaEngine = await FormulaEngine.getInstance(tableId);
    }

    // Process updates and prepare batch operations
    const batchUpdates: Array<{
      id: number;
      valueJson: string | null;
      formula: string | null;
      errorCode: string | null;
    }> = [];

    for (const cellUpdate of cellUpdates) {
      try {
        const cellKey = `${cellUpdate.rowId}-${cellUpdate.columnId}`;
        const existingCell = cellMap.get(cellKey);

        if (!existingCell) {
          errors.push({
            rowId: cellUpdate.rowId,
            columnId: cellUpdate.columnId,
            error: 'Cell not found'
          });
          continue;
        }

        let finalValue: any = null;
        let finalFormula: string | null = null;
        let errorCode: string | null = null;

        if (cellUpdate.formula !== undefined) {
          // Formula update
          if (cellUpdate.formula !== null) {
            finalFormula = cellUpdate.formula;
            
            if (formulaEngine) {
              const cellMapper = formulaEngine.getCellMapper();
              const a1Ref = cellMapper.cellToA1(cellUpdate.rowId, cellUpdate.columnId);
              
              if (a1Ref) {
                // Validate formula syntax
                const validation = formulaEngine.validateFormula(cellUpdate.formula);
                if (!validation.isValid) {
                  errors.push({
                    rowId: cellUpdate.rowId,
                    columnId: cellUpdate.columnId,
                    error: `Invalid formula: ${validation.error}`
                  });
                  continue;
                }

                formulaUpdates.push({
                  a1Ref,
                  formula: cellUpdate.formula,
                  value: null
                });
              }
            }
          } else {
            // Clear formula
            finalFormula = null;
            finalValue = null;
            
            if (formulaEngine) {
              const cellMapper = formulaEngine.getCellMapper();
              const a1Ref = cellMapper.cellToA1(cellUpdate.rowId, cellUpdate.columnId);
              
              if (a1Ref) {
                formulaUpdates.push({
                  a1Ref,
                  formula: null,
                  value: null
                });
              }
            }
          }
        } else {
          // Direct value update
          finalValue = cellUpdate.value;
          finalFormula = null;
          
          if (formulaEngine && existingCell.currentFormula) {
            const cellMapper = formulaEngine.getCellMapper();
            const a1Ref = cellMapper.cellToA1(cellUpdate.rowId, cellUpdate.columnId);
            
            if (a1Ref) {
              formulaUpdates.push({
                a1Ref,
                formula: null,
                value: finalValue
              });
            }
          }
        }

        batchUpdates.push({
          id: existingCell.id,
          valueJson: finalValue !== null ? JSON.stringify(finalValue) : null,
          formula: finalFormula,
          errorCode: errorCode,
        });

        updatedCount++;

      } catch (error) {
        errors.push({
          rowId: cellUpdate.rowId,
          columnId: cellUpdate.columnId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // ⚡ PERFORMANCE OPTIMIZED: Execute batch database update with larger chunks
    if (batchUpdates.length > 0) {
      await db.transaction(async (tx) => {
        // For very large updates (>500), process in sub-batches to avoid SQL query size limits
        const maxBatchSize = 500;
        
        for (let i = 0; i < batchUpdates.length; i += maxBatchSize) {
          const batch = batchUpdates.slice(i, i + maxBatchSize);
          
          // Use CASE-WHEN for efficient bulk update
          const caseConditions = batch.map(update =>
            `WHEN id = ${update.id} THEN ${update.valueJson ? `'${update.valueJson.replace(/'/g, "''")}'` : 'NULL'}`
          ).join(' ');

          const formulaCaseConditions = batch.map(update =>
            `WHEN id = ${update.id} THEN ${update.formula ? `'${update.formula.replace(/'/g, "''")}'` : 'NULL'}`
          ).join(' ');

          const errorCaseConditions = batch.map(update =>
            `WHEN id = ${update.id} THEN ${update.errorCode ? `'${update.errorCode.replace(/'/g, "''")}'` : 'NULL'}`
          ).join(' ');

          const ids = batch.map(update => update.id);

          if (caseConditions) {
            await tx.execute(sql`
              UPDATE cells SET
                value_json = CASE ${sql.raw(caseConditions)} ELSE value_json END,
                formula = CASE ${sql.raw(formulaCaseConditions)} ELSE formula END,
                error_code = CASE ${sql.raw(errorCaseConditions)} ELSE error_code END,
                calc_version = calc_version + 1,
                updated_at = NOW()
              WHERE id = ANY(${ids})
            `);
          }
        }
      });
    }

    // Process formula updates if needed
    if (formulaEngine && formulaUpdates.length > 0 && !options.skipFormulaRecalc) {
      try {
        const allA1Refs: string[] = [];
        
        // Apply all formula/value updates to engine
        for (const update of formulaUpdates) {
          if (update.formula !== null) {
            await formulaEngine.setCellFormula(update.a1Ref, update.formula);
          } else {
            await formulaEngine.setCellValue(update.a1Ref, update.value);
          }
          allA1Refs.push(update.a1Ref);
        }

        // Single recalculation for all affected cells (optimization!)
        const recalcResult = await formulaEngine.recalcAffected(allA1Refs);
        
        // Update affected cells in database
        for (const affectedCell of recalcResult.affectedCells) {
          const cellMapper = formulaEngine.getCellMapper();
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
              await db
                .update(cells)
                .set({
                  valueJson: affectedCell.value !== null ? JSON.stringify(affectedCell.value) : null,
                  errorCode: affectedCell.error ? ErrorCodeMapper.mapHyperFormulaError(affectedCell.error) : null,
                  calcVersion: sql`calc_version + 1`,
                })
                .where(eq(cells.id, affectedCellInfo[0].id));

              updatedCells.push({
                id: affectedCellInfo[0].id,
                value: affectedCell.value,
                error: affectedCell.error ? ErrorCodeMapper.mapHyperFormulaError(affectedCell.error) : null,
              });
            }
          }
        }
      } catch (formulaError) {
        // Reduced logging for production performance
        if (process.env.NODE_ENV === 'development') {
          console.error('Formula processing error:', formulaError);
        }
        // Don't fail the entire operation for formula errors
      }
    }

    // Log audit entry
    if (authResult.context?.permissionContext.userId) {
      await AuditLogger.log(
        {
          userId: authResult.context.permissionContext.userId,
          tableId: tableId,
        },
        'bulk_cell_update',
        {
          after: {
            cellCount: cellUpdates.length,
            updatedCount,
            errorCount: errors.length,
            chunkId: options.chunkId,
            isLastChunk: options.isLastChunk,
          }
        }
      );
    }

    // Calculate performance metrics
    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;
    const cellsPerSecond = Math.round((cellUpdates.length / processingTimeMs) * 1000);

    const response: ApiResponse<BulkUpdateResponse> = {
      data: {
        success: errors.length === 0,
        updatedCount,
        errors,
        affectedCells: updatedCells.map(cell => ({
          ...cell,
          error: cell.error || undefined
        })),
        performance: {
          processingTimeMs,
          cellsPerSecond,
        },
      },
      message: errors.length === 0
        ? `Successfully updated ${updatedCount} cells`
        : `Updated ${updatedCount} cells with ${errors.length} errors`,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Bulk cell update error:', error);
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}