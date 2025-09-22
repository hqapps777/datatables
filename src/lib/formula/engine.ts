import { HyperFormula, ConfigParams } from 'hyperformula';
import { db } from '@/server/db';
import { tables, columns, rows, cells } from '@/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * A1 notation utilities for mapping between cell coordinates and database IDs
 */
export class A1NotationMapper {
  /**
   * Convert column number to letter (1 = A, 2 = B, ..., 26 = Z, 27 = AA, etc.)
   */
  static columnToLetter(col: number): string {
    let result = '';
    while (col > 0) {
      col--;
      result = String.fromCharCode(65 + (col % 26)) + result;
      col = Math.floor(col / 26);
    }
    return result;
  }

  /**
   * Convert column letter to number (A = 1, B = 2, ..., Z = 26, AA = 27, etc.)
   */
  static letterToColumn(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result;
  }

  /**
   * Convert cell coordinates to A1 notation (1,1 -> A1)
   */
  static coordsToA1(row: number, col: number): string {
    return this.columnToLetter(col) + row;
  }

  /**
   * Parse A1 notation to coordinates (A1 -> {row: 1, col: 1})
   */
  static a1ToCoords(a1: string): { row: number; col: number; isAbsoluteRow: boolean; isAbsoluteCol: boolean } {
    const match = a1.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid A1 notation: ${a1}`);
    }

    const [, dollarCol, colLetters, dollarRow, rowNumber] = match;
    
    return {
      row: parseInt(rowNumber, 10),
      col: this.letterToColumn(colLetters),
      isAbsoluteCol: dollarCol === '$',
      isAbsoluteRow: dollarRow === '$'
    };
  }

  /**
   * Check if A1 reference is absolute
   */
  static isAbsolute(a1: string): boolean {
    return a1.includes('$');
  }

  /**
   * Make A1 reference absolute
   */
  static makeAbsolute(a1: string): string {
    const coords = this.a1ToCoords(a1);
    return `$${this.columnToLetter(coords.col)}$${coords.row}`;
  }
}

/**
 * Maps database cells to HyperFormula coordinates
 */
export class CellMapper {
  private tableColumns: Map<number, { id: number; name: string; position: number }> = new Map();
  private columnPositions: Map<number, number> = new Map(); // columnId -> position
  private positionToColumnId: Map<number, number> = new Map(); // position -> columnId
  private rowOrder: number[] = []; // Current row order (rowIds in display order)

  constructor(private tableId: number) {}

  /**
   * Load table structure from database
   */
  async loadTableStructure(): Promise<void> {
    const tableColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, this.tableId))
      .orderBy(columns.position);

    this.tableColumns.clear();
    this.columnPositions.clear();
    this.positionToColumnId.clear();

    tableColumns.forEach(col => {
      this.tableColumns.set(col.id, col);
      this.columnPositions.set(col.id, col.position);
      this.positionToColumnId.set(col.position, col.id);
    });
  }

  /**
   * Update the current row order for position-based A1 references
   */
  updateRowOrder(rowOrder: number[]): void {
    this.rowOrder = [...rowOrder];
  }

  /**
   * Convert database cell (rowId, columnId) to A1 notation
   * Uses position in current row order instead of rowId
   */
  cellToA1(rowId: number, columnId: number): string | null {
    const position = this.columnPositions.get(columnId);
    if (position === undefined) return null;

    // Find the current position of this row in the ordered list
    const currentRowPosition = this.rowOrder.findIndex(id => id === rowId) + 1;
    
    // If row not found in order, fall back to rowId (for backward compatibility)
    const rowPosition = currentRowPosition > 0 ? currentRowPosition : rowId;

    return A1NotationMapper.coordsToA1(rowPosition, position);
  }

  /**
   * Convert A1 notation to database coordinates
   * Uses position in current row order to find the correct rowId
   */
  a1ToCell(a1: string): { rowId: number; columnId: number } | null {
    try {
      const coords = A1NotationMapper.a1ToCoords(a1);
      const columnId = this.positionToColumnId.get(coords.col);
      
      if (columnId === undefined) return null;

      // Convert row position to actual rowId using current row order
      const rowId = this.rowOrder[coords.row - 1];
      
      // If no row order or position out of bounds, fall back to direct mapping
      const actualRowId = rowId !== undefined ? rowId : coords.row;

      return {
        rowId: actualRowId,
        columnId
      };
    } catch {
      return null;
    }
  }

  /**
   * Get column position by column ID
   */
  getColumnPosition(columnId: number): number | undefined {
    return this.columnPositions.get(columnId);
  }

  /**
   * Get column ID by position
   */
  getColumnIdByPosition(position: number): number | undefined {
    return this.positionToColumnId.get(position);
  }
}

/**
 * Configuration for HyperFormula engine
 */
const HYPERFORMULA_CONFIG: Partial<ConfigParams> = {
  licenseKey: 'gpl-v3', // Use GPL v3 license
  useColumnIndex: true,
  functionArgSeparator: ',',
  smartRounding: true,
};

/**
 * Singleton Formula Engine per table
 */
export class FormulaEngine {
  private static instances: Map<number, FormulaEngine> = new Map();
  private hf: HyperFormula;
  private sheetId: number;
  private cellMapper: CellMapper;
  private loadedCells: Map<string, any> = new Map(); // A1 -> value

  private constructor(private tableId: number) {
    this.hf = HyperFormula.buildEmpty(HYPERFORMULA_CONFIG);
    this.cellMapper = new CellMapper(tableId);
    // HyperFormula creates a default sheet with ID 0
    this.sheetId = 0;
    // Ensure we have at least one sheet
    if (this.hf.countSheets() === 0) {
      this.hf.addSheet(`table_${tableId}`);
      this.sheetId = 0;
    }
  }

  /**
   * Get or create formula engine instance for a table
   */
  static async getInstance(tableId: number): Promise<FormulaEngine> {
    if (!this.instances.has(tableId)) {
      const engine = new FormulaEngine(tableId);
      await engine.initialize();
      this.instances.set(tableId, engine);
    }
    return this.instances.get(tableId)!;
  }

  /**
   * Initialize the engine with table data
   */
  private async initialize(): Promise<void> {
    await this.cellMapper.loadTableStructure();
    await this.loadAllCells();
  }

  /**
   * Load all cells from database into HyperFormula
   */
  private async loadAllCells(): Promise<void> {
    const tableCells = await db
      .select({
        rowId: cells.rowId,
        columnId: cells.columnId,
        valueJson: cells.valueJson,
        formula: cells.formula,
      })
      .from(cells)
      .innerJoin(rows, eq(cells.rowId, rows.id))
      .where(and(
        eq(rows.tableId, this.tableId),
        isNull(rows.deletedAt) // Only active rows
      ));

    // Clear existing data - ensure sheet exists
    try {
      if (this.hf.countSheets() === 0) {
        this.hf.addSheet(`table_${this.tableId}`);
        this.sheetId = 0;
      } else {
        this.hf.clearSheet(this.sheetId);
      }
    } catch (error) {
      // Fallback: recreate sheet
      this.hf.addSheet(`table_${this.tableId}`);
      this.sheetId = 0;
    }
    this.loadedCells.clear();

    // Load cells into HyperFormula
    const cellsData: any[][] = [];
    const maxRow = Math.max(...tableCells.map(c => c.rowId), 0);
    const maxCol = Math.max(...tableCells.map(c => this.cellMapper.getColumnPosition(c.columnId) || 0), 0);

    // Initialize empty grid
    for (let row = 0; row <= maxRow; row++) {
      cellsData[row] = new Array(maxCol + 1).fill(null);
    }

    // Fill with actual data
    for (const cell of tableCells) {
      const position = this.cellMapper.getColumnPosition(cell.columnId);
      if (position === undefined) continue;

      const a1 = A1NotationMapper.coordsToA1(cell.rowId, position);
      
      if (cell.formula) {
        // Store formula
        cellsData[cell.rowId - 1][position - 1] = cell.formula;
        this.loadedCells.set(a1, cell.formula);
      } else if (cell.valueJson) {
        // Store value
        const value = JSON.parse(cell.valueJson);
        cellsData[cell.rowId - 1][position - 1] = value;
        this.loadedCells.set(a1, value);
      }
    }

    // Set data in HyperFormula if we have any cells
    if (cellsData.length > 0 && cellsData[0].length > 0) {
      this.hf.setSheetContent(this.sheetId, cellsData);
    }
  }

  /**
   * Evaluate a single cell by A1 reference
   */
  async evaluateCell(a1Ref: string): Promise<{ value: any; error?: string }> {
    try {
      const coords = A1NotationMapper.a1ToCoords(a1Ref);
      const cellValue = this.hf.getCellValue({ sheet: this.sheetId, row: coords.row - 1, col: coords.col - 1 });
      
      // Handle different result types from HyperFormula
      if (cellValue && typeof cellValue === 'object' && 'error' in cellValue) {
        return {
          value: null,
          error: typeof cellValue.error === 'string' ? cellValue.error : 'Formula error'
        };
      }

      return { value: cellValue };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : 'Evaluation error'
      };
    }
  }

  /**
   * Set cell value or formula
   */
  async setCellValue(a1Ref: string, value: any): Promise<void> {
    const coords = A1NotationMapper.a1ToCoords(a1Ref);
    
    this.hf.setCellContents({ sheet: this.sheetId, row: coords.row - 1, col: coords.col - 1 }, value);
    this.loadedCells.set(a1Ref, value);
  }

  /**
   * Set cell formula
   */
  async setCellFormula(a1Ref: string, formula: string): Promise<void> {
    // Ensure formula starts with =
    const normalizedFormula = formula.startsWith('=') ? formula : `=${formula}`;
    await this.setCellValue(a1Ref, normalizedFormula);
  }

  /**
   * Recalculate affected cells after changes
   */
  async recalcAffected(changedRefs: string[]): Promise<{ 
    affectedCells: { a1: string; value: any; error?: string }[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const affectedCells: { a1: string; value: any; error?: string }[] = [];

    try {
      // Get all dependent cells for the changed cells
      const dependents = new Set<string>();
      
      for (const ref of changedRefs) {
        const coords = A1NotationMapper.a1ToCoords(ref);
        const cellAddress = { sheet: this.sheetId, row: coords.row - 1, col: coords.col - 1 };
        
        // Since we can't easily get dependents, we'll recalculate and check all cells
        // This is a simplified approach - in production you'd want better dependency tracking
        try {
          const allCells = this.hf.getSheetSerialized(this.sheetId);
          if (allCells && Array.isArray(allCells)) {
            for (let row = 0; row < allCells.length; row++) {
              for (let col = 0; col < allCells[row].length; col++) {
                if (allCells[row][col] !== null && allCells[row][col] !== undefined) {
                  const a1 = A1NotationMapper.coordsToA1(row + 1, col + 1);
                  dependents.add(a1);
                }
              }
            }
          }
        } catch (error) {
          // Fallback: just add the changed cell itself
          dependents.add(ref);
        }
      }

      // Evaluate all affected cells
      for (const a1 of dependents) {
        const result = await this.evaluateCell(a1);
        affectedCells.push({
          a1,
          value: result.value,
          error: result.error
        });

        if (result.error) {
          errors.push(`Cell ${a1}: ${result.error}`);
        }
      }

      return { affectedCells, errors };
    } catch (error) {
      errors.push(`Recalculation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { affectedCells, errors };
    }
  }

  /**
   * Get all formulas in the sheet
   */
  getAllFormulas(): Map<string, string> {
    const formulas = new Map<string, string>();
    
    for (const [a1, value] of this.loadedCells.entries()) {
      if (typeof value === 'string' && value.startsWith('=')) {
        formulas.set(a1, value);
      }
    }

    return formulas;
  }

  /**
   * Validate a formula without executing it
   */
  validateFormula(formula: string): { isValid: boolean; error?: string } {
    try {
      const normalizedFormula = formula.startsWith('=') ? formula : `=${formula}`;
      
      // Create a minimal temporary HyperFormula instance for validation
      const tempHF = HyperFormula.buildEmpty(HYPERFORMULA_CONFIG);
      
      try {
        // Add a temporary sheet
        tempHF.addSheet('temp');
        const tempSheetId = 0;
        
        // Set the formula in a test cell
        tempHF.setCellContents({ sheet: tempSheetId, row: 0, col: 0 }, normalizedFormula);
        
        // Get the result to check for errors
        const result = tempHF.getCellValue({ sheet: tempSheetId, row: 0, col: 0 });
        
        if (result && typeof result === 'object' && 'error' in result) {
          return {
            isValid: false,
            error: typeof result.error === 'string' ? result.error : 'Invalid formula'
          };
        }

        return { isValid: true };
      } finally {
        tempHF.destroy();
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Formula validation error'
      };
    }
  }

  /**
   * Clear the engine instance (for cleanup)
   */
  static clearInstance(tableId: number): void {
    const instance = this.instances.get(tableId);
    if (instance) {
      instance.hf.destroy();
      this.instances.delete(tableId);
    }
  }

  /**
   * Get cell mapper for this table
   */
  getCellMapper(): CellMapper {
    return this.cellMapper;
  }
}