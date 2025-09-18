import { FormulaEngine, A1NotationMapper, CellMapper } from './engine';
import { HyperFormula, ConfigParams } from 'hyperformula';
import { db } from '@/server/db';
import { tables, columns, rows, cells } from '@/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Enhanced Formula Engine with cross-table reference support
 * Supports syntax like: Table1!A1:B10, [TableName]!C5, etc.
 */
export class CrossTableFormulaEngine {
  private static instances: Map<number, CrossTableFormulaEngine> = new Map();
  private hf: HyperFormula;
  private primaryTableId: number;
  private tableSheetMapping: Map<number, number> = new Map(); // tableId -> sheetId
  private sheetTableMapping: Map<number, number> = new Map(); // sheetId -> tableId
  private tableCellMappers: Map<number, CellMapper> = new Map();
  private tableNameMapping: Map<string, number> = new Map(); // tableName -> tableId

  private constructor(tableId: number) {
    const config: Partial<ConfigParams> = {
      licenseKey: 'gpl-v3',
      useColumnIndex: true,
      functionArgSeparator: ',',
      smartRounding: true,
    };

    this.hf = HyperFormula.buildEmpty(config);
    this.primaryTableId = tableId;
  }

  /**
   * Get or create cross-table formula engine instance
   */
  static async getInstance(tableId: number): Promise<CrossTableFormulaEngine> {
    if (!this.instances.has(tableId)) {
      const engine = new CrossTableFormulaEngine(tableId);
      await engine.initialize();
      this.instances.set(tableId, engine);
    }
    return this.instances.get(tableId)!;
  }

  /**
   * Initialize the engine with primary table and discover related tables
   */
  private async initialize(): Promise<void> {
    // Load primary table first
    await this.loadTable(this.primaryTableId, true);
    
    // Load table name mappings for cross-references
    await this.loadTableNameMappings();
  }

  /**
   * Load table name mappings for cross-table references
   */
  private async loadTableNameMappings(): Promise<void> {
    const allTables = await db
      .select({
        id: tables.id,
        name: tables.name,
      })
      .from(tables)
      .where(eq(tables.isArchived, false));

    this.tableNameMapping.clear();
    for (const table of allTables) {
      this.tableNameMapping.set(table.name, table.id);
    }
  }

  /**
   * Load a specific table into HyperFormula as a sheet
   */
  private async loadTable(tableId: number, isPrimary: boolean = false): Promise<number> {
    // Check if already loaded
    if (this.tableSheetMapping.has(tableId)) {
      return this.tableSheetMapping.get(tableId)!;
    }

    // Get table info
    const tableInfo = await db
      .select({
        name: tables.name,
      })
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (tableInfo.length === 0) {
      throw new Error(`Table with ID ${tableId} not found`);
    }

    // Create sheet name
    const sheetName = isPrimary ? `table_${tableId}` : tableInfo[0].name;
    
    // Add sheet to HyperFormula
    this.hf.addSheet(sheetName);
    
    // Get the sheet ID by finding the sheet we just added
    const sheetId = this.hf.getSheetId(sheetName);
    
    if (sheetId === undefined) {
      throw new Error(`Failed to create sheet for table ${tableId}`);
    }
    
    // Store mappings
    this.tableSheetMapping.set(tableId, sheetId);
    this.sheetTableMapping.set(sheetId, tableId);

    // Create cell mapper for this table
    const cellMapper = new CellMapper(tableId);
    await cellMapper.loadTableStructure();
    this.tableCellMappers.set(tableId, cellMapper);

    // Load table data
    await this.loadTableData(tableId, sheetId);

    return sheetId;
  }

  /**
   * Load table data into the specified sheet
   */
  private async loadTableData(tableId: number, sheetId: number): Promise<void> {
    // Get all cells for this table
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
        eq(rows.tableId, tableId),
        isNull(rows.deletedAt)
      ));

    // Get cell mapper for this table
    const cellMapper = this.tableCellMappers.get(tableId)!;

    // Build data grid
    const cellsData: any[][] = [];
    const maxRow = Math.max(...tableCells.map(c => c.rowId), 0);
    const maxCol = Math.max(...tableCells.map(c => cellMapper.getColumnPosition(c.columnId) || 0), 0);

    // Initialize empty grid
    for (let row = 0; row <= maxRow; row++) {
      cellsData[row] = new Array(maxCol + 1).fill(null);
    }

    // Fill with actual data
    for (const cell of tableCells) {
      const position = cellMapper.getColumnPosition(cell.columnId);
      if (position === undefined) continue;

      if (cell.formula) {
        // Convert cross-table references in formulas
        const convertedFormula = await this.convertCrossTableReferences(cell.formula);
        cellsData[cell.rowId - 1][position - 1] = convertedFormula;
      } else if (cell.valueJson) {
        const value = JSON.parse(cell.valueJson);
        cellsData[cell.rowId - 1][position - 1] = value;
      }
    }

    // Set data in HyperFormula
    if (cellsData.length > 0 && cellsData[0].length > 0) {
      this.hf.setSheetContent(sheetId, cellsData);
    }
  }

  /**
   * Convert cross-table references in formulas
   * Converts: Table1!A1:B10 -> sheetname!A1:B10 (HyperFormula native syntax)
   */
  private async convertCrossTableReferences(formula: string): Promise<string> {
    // Match patterns like: TableName!A1, TableName!A1:B10, [Table Name]!A1
    const crossTableRegex = /(\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))!([A-Z$]+\d+(?::[A-Z$]+\d+)?)/g;
    
    let convertedFormula = formula;
    let match;

    while ((match = crossTableRegex.exec(formula)) !== null) {
      const fullMatch = match[0];
      const bracketedTableName = match[2];
      const simpleTableName = match[3];
      const cellRange = match[4];
      
      const tableName = bracketedTableName || simpleTableName;
      const referencedTableId = this.tableNameMapping.get(tableName);
      
      if (referencedTableId) {
        try {
          // Load the referenced table if not already loaded
          const sheetId = await this.loadTable(referencedTableId);
          const sheetName = this.hf.getSheetName(sheetId);
          
          // Replace with HyperFormula native sheet reference syntax (using !)
          const hyperFormulaRef = `${sheetName}!${cellRange}`;
          convertedFormula = convertedFormula.replace(fullMatch, hyperFormulaRef);
        } catch (error) {
          // If table can't be loaded, replace with #REF! error
          convertedFormula = convertedFormula.replace(fullMatch, '#REF!');
        }
      } else {
        // Table not found, replace with #REF! error
        convertedFormula = convertedFormula.replace(fullMatch, '#REF!');
      }
    }

    return convertedFormula;
  }

  /**
   * Evaluate a formula with cross-table support
   */
  async evaluateFormula(formula: string, contextTableId?: number): Promise<{ value: any; error?: string }> {
    try {
      const tableId = contextTableId || this.primaryTableId;
      const sheetId = this.tableSheetMapping.get(tableId);
      
      if (!sheetId && sheetId !== 0) {
        throw new Error(`Sheet for table ${tableId} not found`);
      }

      // Convert cross-table references
      const convertedFormula = await this.convertCrossTableReferences(formula);
      
      // Create a temporary cell to evaluate the formula
      const tempRow = 1000; // Use high row number to avoid conflicts
      const tempCol = 1000;
      
      this.hf.setCellContents({ sheet: sheetId, row: tempRow, col: tempCol }, convertedFormula);
      const result = this.hf.getCellValue({ sheet: sheetId, row: tempRow, col: tempCol });
      
      // Clean up temp cell
      this.hf.setCellContents({ sheet: sheetId, row: tempRow, col: tempCol }, null);

      if (result && typeof result === 'object' && 'error' in result) {
        return {
          value: null,
          error: typeof result.error === 'string' ? result.error : 'Formula error'
        };
      }

      return { value: result };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : 'Evaluation error'
      };
    }
  }

  /**
   * Update cell with cross-table formula support
   */
  async updateCellWithFormula(
    tableId: number,
    rowId: number,
    columnId: number,
    formula: string
  ): Promise<{ value: any; error?: string }> {
    try {
      // Get the sheet and cell mapper for this table
      let sheetId = this.tableSheetMapping.get(tableId);
      if (sheetId === undefined) {
        sheetId = await this.loadTable(tableId);
      }

      const cellMapper = this.tableCellMappers.get(tableId)!;
      const position = cellMapper.getColumnPosition(columnId);
      
      if (position === undefined) {
        throw new Error(`Column ${columnId} not found in table ${tableId}`);
      }

      // Convert cross-table references in the formula
      const convertedFormula = await this.convertCrossTableReferences(formula);
      
      // Set the formula in the appropriate cell
      this.hf.setCellContents({ sheet: sheetId, row: rowId - 1, col: position - 1 }, convertedFormula);
      
      // Get the evaluated result
      const result = this.hf.getCellValue({ sheet: sheetId, row: rowId - 1, col: position - 1 });
      
      if (result && typeof result === 'object' && 'error' in result) {
        return {
          value: null,
          error: typeof result.error === 'string' ? result.error : 'Formula error'
        };
      }

      return { value: result };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : 'Update error'
      };
    }
  }

  /**
   * Validate formula with cross-table support
   */
  async validateFormula(formula: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const result = await this.evaluateFormula(formula);
      return {
        isValid: !result.error,
        error: result.error
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Check if a table reference is valid
   */
  async isValidTableReference(tableName: string): Promise<boolean> {
    return this.tableNameMapping.has(tableName);
  }

  /**
   * Get all tables referenced in a formula
   */
  getReferencedTables(formula: string): string[] {
    const crossTableRegex = /(\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))!([A-Z$]+\d+(?::[A-Z$]+\d+)?)/g;
    const referencedTables: string[] = [];
    let match;

    while ((match = crossTableRegex.exec(formula)) !== null) {
      const bracketedTableName = match[2];
      const simpleTableName = match[3];
      const tableName = bracketedTableName || simpleTableName;
      
      if (!referencedTables.includes(tableName)) {
        referencedTables.push(tableName);
      }
    }

    return referencedTables;
  }

  /**
   * Handle table rename/delete by updating references
   */
  async handleTableRename(oldName: string, newName: string): Promise<void> {
    // Update internal mappings
    if (this.tableNameMapping.has(oldName)) {
      const tableId = this.tableNameMapping.get(oldName)!;
      this.tableNameMapping.delete(oldName);
      this.tableNameMapping.set(newName, tableId);
    }
  }

  /**
   * Clean up engine instance
   */
  static clearInstance(tableId: number): void {
    const instance = this.instances.get(tableId);
    if (instance) {
      instance.hf.destroy();
      this.instances.delete(tableId);
    }
  }

  /**
   * Get the underlying HyperFormula instance (for advanced operations)
   */
  getHyperFormula(): HyperFormula {
    return this.hf;
  }

  /**
   * Get primary table ID
   */
  getPrimaryTableId(): number {
    return this.primaryTableId;
  }
}