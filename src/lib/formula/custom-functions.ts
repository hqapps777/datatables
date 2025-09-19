import { HyperFormula } from 'hyperformula';
import { A1NotationMapper } from './engine';

/**
 * Custom function implementations for FILTER, UNIQUE, SORT with size limits
 */

export interface CustomFunctionConfig {
  maxArraySize: number; // Maximum number of items to return
  maxProcessingTime: number; // Maximum processing time in ms
}

export const DEFAULT_FUNCTION_CONFIG: CustomFunctionConfig = {
  maxArraySize: 1000,
  maxProcessingTime: 5000,
};

/**
 * Custom UNIQUE function implementation
 * Returns unique values from a range with size limits
 */
export class UniqueFunction {
  private config: CustomFunctionConfig;

  constructor(config: CustomFunctionConfig = DEFAULT_FUNCTION_CONFIG) {
    this.config = config;
  }

  /**
   * Process UNIQUE function: =UNIQUE(array)
   */
  process(range: any[][], options: { caseSensitive?: boolean } = {}): any[] {
    const startTime = Date.now();
    const unique: any[] = [];
    const seen = new Set<string>();
    let processedCount = 0;

    for (const row of range) {
      for (const cell of row) {
        // Check processing time limit
        if (Date.now() - startTime > this.config.maxProcessingTime) {
          console.warn(`UNIQUE function timed out after ${this.config.maxProcessingTime}ms`);
          break;
        }

        // Check size limit
        if (unique.length >= this.config.maxArraySize) {
          console.warn(`UNIQUE function reached size limit of ${this.config.maxArraySize} items`);
          break;
        }

        if (cell != null) {
          const key = options.caseSensitive ? String(cell) : String(cell).toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(cell);
            processedCount++;
          }
        }
      }
    }

    console.log(`UNIQUE processed ${processedCount} items, returned ${unique.length} unique values`);
    return unique;
  }

  /**
   * Parse range from HyperFormula and apply UNIQUE
   */
  static applyToRange(
    hf: HyperFormula,
    sheetId: number,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    config?: CustomFunctionConfig
  ): any[] {
    const uniqueFunc = new UniqueFunction(config);
    const range: any[][] = [];

    // Extract data from HyperFormula
    for (let row = startRow; row <= endRow; row++) {
      const rowData: any[] = [];
      for (let col = startCol; col <= endCol; col++) {
        const cellValue = hf.getCellValue({ sheet: sheetId, row, col });
        rowData.push(cellValue);
      }
      range.push(rowData);
    }

    return uniqueFunc.process(range);
  }
}

/**
 * Custom SORT function implementation
 * Sorts values from a range with size limits
 */
export class SortFunction {
  private config: CustomFunctionConfig;

  constructor(config: CustomFunctionConfig = DEFAULT_FUNCTION_CONFIG) {
    this.config = config;
  }

  /**
   * Process SORT function: =SORT(array, sortColumn, ascending)
   */
  process(
    range: any[][], 
    options: { 
      sortColumn?: number; 
      ascending?: boolean; 
      sortBy?: 'value' | 'text' | 'number' 
    } = {}
  ): any[][] {
    const startTime = Date.now();
    const { sortColumn = 0, ascending = true, sortBy = 'value' } = options;

    // Flatten and limit data
    const flatData = range.flat().filter(cell => cell != null);
    const limitedData = flatData.slice(0, this.config.maxArraySize);

    if (flatData.length > this.config.maxArraySize) {
      console.warn(`SORT function limited to ${this.config.maxArraySize} items (was ${flatData.length})`);
    }

    // Sort with timeout protection
    const sorted = limitedData.sort((a, b) => {
      // Check processing time limit
      if (Date.now() - startTime > this.config.maxProcessingTime) {
        console.warn(`SORT function timed out after ${this.config.maxProcessingTime}ms`);
        return 0;
      }

      let comparison = 0;

      if (sortBy === 'number') {
        const numA = Number(a);
        const numB = Number(b);
        comparison = numA - numB;
      } else if (sortBy === 'text') {
        comparison = String(a).localeCompare(String(b));
      } else {
        // Auto-detect type and sort
        const aIsNum = !isNaN(Number(a));
        const bIsNum = !isNaN(Number(b));

        if (aIsNum && bIsNum) {
          comparison = Number(a) - Number(b);
        } else {
          comparison = String(a).localeCompare(String(b));
        }
      }

      return ascending ? comparison : -comparison;
    });

    console.log(`SORT processed ${limitedData.length} items`);
    return sorted.map(item => [item]); // Return as 2D array for consistency
  }

  /**
   * Parse range from HyperFormula and apply SORT
   */
  static applyToRange(
    hf: HyperFormula,
    sheetId: number,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    options?: { sortColumn?: number; ascending?: boolean; sortBy?: 'value' | 'text' | 'number' },
    config?: CustomFunctionConfig
  ): any[][] {
    const sortFunc = new SortFunction(config);
    const range: any[][] = [];

    // Extract data from HyperFormula
    for (let row = startRow; row <= endRow; row++) {
      const rowData: any[] = [];
      for (let col = startCol; col <= endCol; col++) {
        const cellValue = hf.getCellValue({ sheet: sheetId, row, col });
        rowData.push(cellValue);
      }
      range.push(rowData);
    }

    return sortFunc.process(range, options);
  }
}

/**
 * Enhanced FILTER function implementation
 * Filters values from a range with size limits
 */
export class FilterFunction {
  private config: CustomFunctionConfig;

  constructor(config: CustomFunctionConfig = DEFAULT_FUNCTION_CONFIG) {
    this.config = config;
  }

  /**
   * Process FILTER function: =FILTER(array, condition)
   */
  process(
    dataRange: any[][],
    conditionRange: boolean[][],
    options: { includeHeaders?: boolean } = {}
  ): any[][] {
    const startTime = Date.now();
    const filtered: any[][] = [];
    const { includeHeaders = false } = options;

    // Validate range dimensions
    if (dataRange.length !== conditionRange.length) {
      throw new Error('FILTER: Data and condition ranges must have same number of rows');
    }

    let processedRows = 0;

    for (let rowIndex = 0; rowIndex < dataRange.length; rowIndex++) {
      // Check processing time limit
      if (Date.now() - startTime > this.config.maxProcessingTime) {
        console.warn(`FILTER function timed out after ${this.config.maxProcessingTime}ms`);
        break;
      }

      // Check size limit
      if (filtered.length >= this.config.maxArraySize) {
        console.warn(`FILTER function reached size limit of ${this.config.maxArraySize} rows`);
        break;
      }

      const dataRow = dataRange[rowIndex];
      const conditionRow = conditionRange[rowIndex];

      // Include headers regardless of condition
      if (includeHeaders && rowIndex === 0) {
        filtered.push([...dataRow]);
        continue;
      }

      // Check if any condition in the row is true
      const shouldInclude = conditionRow.some(condition => condition === true);
      
      if (shouldInclude) {
        filtered.push([...dataRow]);
      }

      processedRows++;
    }

    console.log(`FILTER processed ${processedRows} rows, returned ${filtered.length} filtered rows`);
    return filtered;
  }

  /**
   * Apply simple value filter (e.g., column = "Fruit")
   */
  processSimpleFilter(
    dataRange: any[][],
    filterColumn: number,
    filterValue: any,
    comparison: 'equals' | 'contains' | 'greater' | 'less' | 'not_equals' = 'equals'
  ): any[][] {
    const startTime = Date.now();
    const filtered: any[][] = [];
    let processedRows = 0;

    for (let rowIndex = 0; rowIndex < dataRange.length; rowIndex++) {
      // Check processing time and size limits
      if (Date.now() - startTime > this.config.maxProcessingTime) {
        console.warn(`FILTER function timed out after ${this.config.maxProcessingTime}ms`);
        break;
      }

      if (filtered.length >= this.config.maxArraySize) {
        console.warn(`FILTER function reached size limit of ${this.config.maxArraySize} rows`);
        break;
      }

      const row = dataRange[rowIndex];
      const cellValue = row[filterColumn];

      let shouldInclude = false;

      switch (comparison) {
        case 'equals':
          shouldInclude = cellValue === filterValue;
          break;
        case 'not_equals':
          shouldInclude = cellValue !== filterValue;
          break;
        case 'contains':
          shouldInclude = String(cellValue).includes(String(filterValue));
          break;
        case 'greater':
          shouldInclude = Number(cellValue) > Number(filterValue);
          break;
        case 'less':
          shouldInclude = Number(cellValue) < Number(filterValue);
          break;
      }

      if (shouldInclude) {
        filtered.push([...row]);
      }

      processedRows++;
    }

    console.log(`FILTER processed ${processedRows} rows, returned ${filtered.length} filtered rows`);
    return filtered;
  }
}

/**
 * Custom function registry for extending HyperFormula
 */
export class CustomFunctionRegistry {
  private config: CustomFunctionConfig;

  constructor(config: CustomFunctionConfig = DEFAULT_FUNCTION_CONFIG) {
    this.config = config;
  }

  /**
   * Process custom function calls
   */
  processCustomFunction(
    functionName: string,
    args: any[],
    hf: HyperFormula,
    sheetId: number
  ): any {
    switch (functionName.toUpperCase()) {
      case 'UNIQUE':
        return this.processUniqueFunction(args, hf, sheetId);
      case 'SORT':
        return this.processSortFunction(args, hf, sheetId);
      case 'FILTER_CUSTOM':
        return this.processFilterFunction(args, hf, sheetId);
      default:
        throw new Error(`Custom function ${functionName} not recognized`);
    }
  }

  private processUniqueFunction(args: any[], hf: HyperFormula, sheetId: number): any {
    if (args.length < 1) {
      throw new Error('UNIQUE function requires at least 1 argument');
    }

    // For now, return a placeholder - full implementation would parse range
    console.log('UNIQUE function called with args:', args);
    return ['Apple', 'Banana', 'Carrot']; // Placeholder
  }

  private processSortFunction(args: any[], hf: HyperFormula, sheetId: number): any {
    if (args.length < 1) {
      throw new Error('SORT function requires at least 1 argument');
    }

    // For now, return a placeholder - full implementation would parse range
    console.log('SORT function called with args:', args);
    return ['Apple', 'Banana', 'Carrot']; // Placeholder
  }

  private processFilterFunction(args: any[], hf: HyperFormula, sheetId: number): any {
    if (args.length < 2) {
      throw new Error('FILTER function requires at least 2 arguments');
    }

    // For now, return a placeholder - full implementation would parse range
    console.log('FILTER function called with args:', args);
    return ['Apple', 'Banana']; // Placeholder
  }
}