import { FormulaEngine, A1NotationMapper } from './engine';
import { db } from '@/server/db';
import { cells } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Integration layer between Formula Engine and database operations
 */
export class FormulaIntegration {
  /**
   * Process cell update with formula evaluation
   */
  static async updateCellWithFormula(
    tableId: number,
    rowId: number,
    columnId: number,
    value: any,
    formula?: string
  ): Promise<{ 
    value: any; 
    formula?: string; 
    error?: string; 
    affectedCells?: Array<{ rowId: number; columnId: number; value: any; error?: string }>;
  }> {
    const engine = await FormulaEngine.getInstance(tableId);
    const cellMapper = engine.getCellMapper();
    
    // Convert database coordinates to A1 notation
    const a1Ref = cellMapper.cellToA1(rowId, columnId);
    if (!a1Ref) {
      return { value, error: 'Invalid cell coordinates' };
    }

    let processedValue = value;
    let cellError: string | undefined;
    let affectedCells: Array<{ rowId: number; columnId: number; value: any; error?: string }> = [];

    try {
      if (formula) {
        // Validate formula first
        const validation = engine.validateFormula(formula);
        if (!validation.isValid) {
          return { 
            value: null, 
            formula, 
            error: validation.error 
          };
        }

        // Set formula in engine
        await engine.setCellFormula(a1Ref, formula);
        
        // Evaluate the formula
        const result = await engine.evaluateCell(a1Ref);
        processedValue = result.value;
        cellError = result.error;
      } else {
        // Set plain value
        await engine.setCellValue(a1Ref, value);
      }

      // Recalculate affected cells
      const recalcResult = await engine.recalcAffected([a1Ref]);
      
      // Convert affected cells back to database coordinates
      for (const affectedCell of recalcResult.affectedCells) {
        const cellCoords = cellMapper.a1ToCell(affectedCell.a1);
        if (cellCoords) {
          affectedCells.push({
            rowId: cellCoords.rowId,
            columnId: cellCoords.columnId,
            value: affectedCell.value,
            error: affectedCell.error,
          });
        }
      }

      return {
        value: processedValue,
        formula,
        error: cellError,
        affectedCells,
      };

    } catch (error) {
      return {
        value: null,
        formula,
        error: error instanceof Error ? error.message : 'Formula processing error',
      };
    }
  }

  /**
   * Batch update multiple cells with formula recalculation
   */
  static async updateMultipleCells(
    tableId: number,
    updates: Array<{
      rowId: number;
      columnId: number;
      value: any;
      formula?: string;
    }>
  ): Promise<{
    results: Array<{ 
      rowId: number; 
      columnId: number; 
      value: any; 
      formula?: string; 
      error?: string; 
    }>;
    affectedCells: Array<{ rowId: number; columnId: number; value: any; error?: string }>;
    errors: string[];
  }> {
    const engine = await FormulaEngine.getInstance(tableId);
    const cellMapper = engine.getCellMapper();
    
    const results: Array<{ 
      rowId: number; 
      columnId: number; 
      value: any; 
      formula?: string; 
      error?: string; 
    }> = [];
    
    const changedA1Refs: string[] = [];
    const errors: string[] = [];

    // Process all updates
    for (const update of updates) {
      const a1Ref = cellMapper.cellToA1(update.rowId, update.columnId);
      if (!a1Ref) {
        results.push({
          ...update,
          error: 'Invalid cell coordinates',
        });
        continue;
      }

      try {
        if (update.formula) {
          // Validate formula
          const validation = engine.validateFormula(update.formula);
          if (!validation.isValid) {
            results.push({
              ...update,
              value: null,
              error: validation.error,
            });
            continue;
          }

          // Set formula
          await engine.setCellFormula(a1Ref, update.formula);
          
          // Evaluate
          const result = await engine.evaluateCell(a1Ref);
          results.push({
            ...update,
            value: result.value,
            error: result.error,
          });
        } else {
          // Set value
          await engine.setCellValue(a1Ref, update.value);
          results.push(update);
        }

        changedA1Refs.push(a1Ref);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Processing error';
        results.push({
          ...update,
          value: null,
          error: errorMsg,
        });
        errors.push(`Cell ${a1Ref}: ${errorMsg}`);
      }
    }

    // Recalculate all affected cells
    const recalcResult = await engine.recalcAffected(changedA1Refs);
    const affectedCells: Array<{ rowId: number; columnId: number; value: any; error?: string }> = [];

    for (const affectedCell of recalcResult.affectedCells) {
      const cellCoords = cellMapper.a1ToCell(affectedCell.a1);
      if (cellCoords) {
        affectedCells.push({
          rowId: cellCoords.rowId,
          columnId: cellCoords.columnId,
          value: affectedCell.value,
          error: affectedCell.error,
        });
      }
    }

    errors.push(...recalcResult.errors);

    return {
      results,
      affectedCells,
      errors,
    };
  }

  /**
   * Get formula for a specific cell
   */
  static async getCellFormula(
    tableId: number, 
    rowId: number, 
    columnId: number
  ): Promise<string | null> {
    try {
      const engine = await FormulaEngine.getInstance(tableId);
      const cellMapper = engine.getCellMapper();
      
      const a1Ref = cellMapper.cellToA1(rowId, columnId);
      if (!a1Ref) return null;

      const formulas = engine.getAllFormulas();
      return formulas.get(a1Ref) || null;
    } catch (error) {
      console.error('Error getting cell formula:', error);
      return null;
    }
  }

  /**
   * Evaluate formula without saving
   */
  static async evaluateFormulaPreview(
    tableId: number,
    formula: string
  ): Promise<{ value: any; error?: string; isValid: boolean }> {
    try {
      const engine = await FormulaEngine.getInstance(tableId);
      
      // Validate first
      const validation = engine.validateFormula(formula);
      if (!validation.isValid) {
        return {
          value: null,
          error: validation.error,
          isValid: false,
        };
      }

      // Create temporary evaluation
      const tempEngine = await FormulaEngine.getInstance(tableId);
      const result = await tempEngine.evaluateCell('A1000'); // Use a temp cell
      
      return {
        value: result.value,
        error: result.error,
        isValid: !result.error,
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : 'Evaluation error',
        isValid: false,
      };
    }
  }

  /**
   * Get all cells with formulas in a table
   */
  static async getFormulaCells(tableId: number): Promise<Array<{
    rowId: number;
    columnId: number;
    formula: string;
    value: any;
    error?: string;
  }>> {
    try {
      const engine = await FormulaEngine.getInstance(tableId);
      const cellMapper = engine.getCellMapper();
      const formulas = engine.getAllFormulas();
      
      const results: Array<{
        rowId: number;
        columnId: number;
        formula: string;
        value: any;
        error?: string;
      }> = [];

      for (const [a1Ref, formula] of formulas.entries()) {
        const coords = cellMapper.a1ToCell(a1Ref);
        if (coords) {
          const evaluation = await engine.evaluateCell(a1Ref);
          results.push({
            rowId: coords.rowId,
            columnId: coords.columnId,
            formula,
            value: evaluation.value,
            error: evaluation.error,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error getting formula cells:', error);
      return [];
    }
  }

  /**
   * Update row order in formula engine for correct A1 references after drag & drop
   */
  static async updateRowOrder(tableId: number, newRowOrder: number[]): Promise<void> {
    try {
      const engine = await FormulaEngine.getInstance(tableId);
      const cellMapper = engine.getCellMapper();
      cellMapper.updateRowOrder(newRowOrder);
      
      // Trigger recalculation of all cells to update references
      const formulas = engine.getAllFormulas();
      const allA1Refs = Array.from(formulas.keys());
      
      if (allA1Refs.length > 0) {
        await engine.recalcAffected(allA1Refs);
      }
    } catch (error) {
      console.error('Error updating row order in formula engine:', error);
    }
  }

  /**
   * Clear formula engine cache for a table (useful for cleanup)
   */
  static clearTableCache(tableId: number): void {
    FormulaEngine.clearInstance(tableId);
  }
}