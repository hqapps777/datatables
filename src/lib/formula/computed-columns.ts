import { FormulaEngine, A1NotationMapper } from './engine';
import { FormulaIntegration } from './integration';
import { db } from '@/server/db';
import { columns, rows, cells } from '@/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Service for handling computed columns with column name references
 * Supports formulas like =[Preis]*0.19 where [Preis] refers to column names
 */
export class ComputedColumnsService {
  /**
   * Convert column name references [ColumnName] to A1 notation relative to current row
   */
  static async convertColumnReferencesToA1(
    tableId: number,
    formula: string,
    currentRowId: number
  ): Promise<string> {
    // Get all columns for the table
    const tableColumns = await db
      .select({
        id: columns.id,
        name: columns.name,
        position: columns.position,
      })
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    // Create a mapping from column names to positions
    const columnNameToPosition: Map<string, number> = new Map();
    tableColumns.forEach(col => {
      columnNameToPosition.set(col.name, col.position);
    });

    // Replace [ColumnName] patterns with A1 notation
    let convertedFormula = formula;
    const columnRefRegex = /\[([^\]]+)\]/g;
    
    convertedFormula = convertedFormula.replace(columnRefRegex, (match, columnName) => {
      const position = columnNameToPosition.get(columnName);
      if (position !== undefined) {
        // Convert to A1 notation using current row
        return A1NotationMapper.coordsToA1(currentRowId, position);
      }
      // If column not found, leave as is (will cause formula error)
      return match;
    });

    return convertedFormula;
  }

  /**
   * Recalculate all cells for a computed column
   */
  static async recalculateComputedColumn(
    tableId: number,
    columnId: number,
    formula: string
  ): Promise<{
    success: boolean;
    results: Array<{
      rowId: number;
      value: any;
      error?: string;
    }>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const results: Array<{ rowId: number; value: any; error?: string }> = [];

    try {
      // Get all active rows for this table
      const tableRows = await db
        .select({
          id: rows.id,
        })
        .from(rows)
        .where(and(
          eq(rows.tableId, tableId),
          isNull(rows.deletedAt)
        ));

      const formulaEngine = await FormulaEngine.getInstance(tableId);

      // Process each row
      for (const row of tableRows) {
        try {
          // Convert column references to A1 notation for this row
          const a1Formula = await this.convertColumnReferencesToA1(
            tableId, 
            formula, 
            row.id
          );

          // Validate the converted formula
          const validation = formulaEngine.validateFormula(a1Formula);
          if (!validation.isValid) {
            results.push({
              rowId: row.id,
              value: null,
              error: validation.error,
            });
            errors.push(`Row ${row.id}: ${validation.error}`);
            continue;
          }

          // Update the cell using formula integration
          const updateResult = await FormulaIntegration.updateCellWithFormula(
            tableId,
            row.id,
            columnId,
            null, // No direct value, use formula
            a1Formula
          );

          results.push({
            rowId: row.id,
            value: updateResult.value,
            error: updateResult.error,
          });

          if (updateResult.error) {
            errors.push(`Row ${row.id}: ${updateResult.error}`);
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            rowId: row.id,
            value: null,
            error: errorMessage,
          });
          errors.push(`Row ${row.id}: ${errorMessage}`);
        }
      }

      return {
        success: errors.length === 0,
        results,
        errors,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Recalculation failed: ${errorMessage}`);
      return {
        success: false,
        results,
        errors,
      };
    }
  }

  /**
   * Validate a computed column formula
   */
  static async validateComputedColumnFormula(
    tableId: number,
    formula: string
  ): Promise<{
    isValid: boolean;
    error?: string;
    sampleValue?: any;
  }> {
    try {
      // Get a sample row to test the formula
      const sampleRow = await db
        .select({
          id: rows.id,
        })
        .from(rows)
        .where(and(
          eq(rows.tableId, tableId),
          isNull(rows.deletedAt)
        ))
        .limit(1);

      if (sampleRow.length === 0) {
        return {
          isValid: true, // Formula is syntactically valid, no data to test
          sampleValue: null,
        };
      }

      // Convert column references for the sample row
      const a1Formula = await this.convertColumnReferencesToA1(
        tableId,
        formula,
        sampleRow[0].id
      );

      // Validate using the formula engine
      const formulaEngine = await FormulaEngine.getInstance(tableId);
      const validation = formulaEngine.validateFormula(a1Formula);

      if (!validation.isValid) {
        return {
          isValid: false,
          error: validation.error,
        };
      }

      // Try to evaluate for sample value
      try {
        const cellMapper = formulaEngine.getCellMapper();
        const tempA1 = cellMapper.cellToA1(sampleRow[0].id, 1); // Use first column position
        
        if (tempA1) {
          await formulaEngine.setCellFormula(tempA1, a1Formula);
          const evaluation = await formulaEngine.evaluateCell(tempA1);
          
          return {
            isValid: !evaluation.error,
            error: evaluation.error,
            sampleValue: evaluation.value,
          };
        }
      } catch {
        // If evaluation fails, still return valid if syntax was okay
      }

      return {
        isValid: true,
        sampleValue: null,
      };

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation error',
      };
    }
  }

  /**
   * Get column dependencies for a computed column formula
   */
  static async getFormulaDependencies(
    tableId: number,
    formula: string
  ): Promise<{
    dependencies: Array<{
      columnId: number;
      columnName: string;
    }>;
    error?: string;
  }> {
    try {
      // Get all columns for the table
      const tableColumns = await db
        .select({
          id: columns.id,
          name: columns.name,
        })
        .from(columns)
        .where(eq(columns.tableId, tableId));

      const dependencies: Array<{ columnId: number; columnName: string }> = [];
      const columnRefRegex = /\[([^\]]+)\]/g;
      let match;

      while ((match = columnRefRegex.exec(formula)) !== null) {
        const columnName = match[1];
        const column = tableColumns.find(col => col.name === columnName);
        
        if (column) {
          // Avoid duplicates
          if (!dependencies.some(dep => dep.columnId === column.id)) {
            dependencies.push({
              columnId: column.id,
              columnName: column.name,
            });
          }
        }
      }

      return { dependencies };

    } catch (error) {
      return {
        dependencies: [],
        error: error instanceof Error ? error.message : 'Error analyzing dependencies',
      };
    }
  }

  /**
   * Update computed cells when a dependency column changes
   */
  static async propagateColumnChanges(
    tableId: number,
    changedColumnId: number,
    affectedRowIds?: number[]
  ): Promise<{
    affectedComputedColumns: number;
    recalculatedCells: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let affectedComputedColumns = 0;
    let recalculatedCells = 0;

    try {
      // Find all computed columns in this table
      const computedColumns = await db
        .select({
          id: columns.id,
          formula: columns.formula,
          name: columns.name,
        })
        .from(columns)
        .where(and(
          eq(columns.tableId, tableId),
          eq(columns.isComputed, true)
        ));

      // Get the name of the changed column
      const changedColumn = await db
        .select({ name: columns.name })
        .from(columns)
        .where(eq(columns.id, changedColumnId))
        .limit(1);

      if (changedColumn.length === 0) {
        return { affectedComputedColumns: 0, recalculatedCells: 0, errors: ['Changed column not found'] };
      }

      const changedColumnName = changedColumn[0].name;

      // Check which computed columns depend on the changed column
      for (const computedColumn of computedColumns) {
        if (!computedColumn.formula) continue;

        // Check if this computed column references the changed column
        const dependencyResult = await this.getFormulaDependencies(tableId, computedColumn.formula);
        const dependsOnChanged = dependencyResult.dependencies.some(
          dep => dep.columnName === changedColumnName
        );

        if (dependsOnChanged) {
          affectedComputedColumns++;

          // Recalculate this computed column for affected rows
          let rowsToRecalculate = affectedRowIds;
          
          if (!rowsToRecalculate) {
            // Recalculate all rows if no specific rows provided
            const allRows = await db
              .select({ id: rows.id })
              .from(rows)
              .where(and(
                eq(rows.tableId, tableId),
                isNull(rows.deletedAt)
              ));
            rowsToRecalculate = allRows.map(r => r.id);
          }

          // Recalculate each affected row
          for (const rowId of rowsToRecalculate) {
            try {
              const a1Formula = await this.convertColumnReferencesToA1(
                tableId,
                computedColumn.formula,
                rowId
              );

              const updateResult = await FormulaIntegration.updateCellWithFormula(
                tableId,
                rowId,
                computedColumn.id,
                null,
                a1Formula
              );

              if (updateResult.error) {
                errors.push(`Column ${computedColumn.name}, Row ${rowId}: ${updateResult.error}`);
              } else {
                recalculatedCells++;
              }

            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              errors.push(`Column ${computedColumn.name}, Row ${rowId}: ${errorMsg}`);
            }
          }
        }
      }

      return {
        affectedComputedColumns,
        recalculatedCells,
        errors,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Propagation failed: ${errorMsg}`);
      return {
        affectedComputedColumns: 0,
        recalculatedCells: 0,
        errors,
      };
    }
  }
}