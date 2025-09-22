/**
 * CSV Import/Export Utilities
 * Handles parsing and generating CSV data for DataTables
 */

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export interface CSVColumn {
  name: string;
  type: 'text' | 'number' | 'email' | 'select' | 'date';
  position: number;
}

export interface ColumnMapping {
  csvColumnIndex: number;
  tableColumnId: number;
  csvColumnName: string;
  tableColumnName: string;
  createNew?: boolean;
}

/**
 * Parse CSV content string into structured data
 */
export function parseCSV(csvContent: string): CSVParseResult {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV-Datei ist leer');
  }

  // Parse first line as headers
  const headers = parseCSVLine(lines[0]);
  
  // Parse remaining lines as data rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    // Skip empty rows
    if (row.some(cell => cell.trim())) {
      rows.push(row);
    }
  }

  return {
    headers,
    rows,
    totalRows: rows.length
  };
}

/**
 * Parse a single CSV line, handling quoted values and commas
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add final field
  result.push(current.trim());
  return result;
}

/**
 * Generate CSV content from table data
 */
export function generateCSV(
  columns: { id: number; name: string; position: number }[],
  rows: Array<{ id: number; cells: Array<{ columnId: number; value: any; formula?: string }> }>,
  options: {
    includeFormulas?: boolean;
    exportType?: 'values' | 'formulas';
  } = {}
): string {
  const { includeFormulas = false, exportType = 'values' } = options;
  
  // Sort columns by position
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
  
  // Generate header row
  let csvLines: string[] = [];
  const headers = sortedColumns.map(col => escapeCSVValue(col.name));
  csvLines.push(headers.join(','));

  // Generate data rows
  for (const row of rows) {
    const csvRow: string[] = [];
    
    for (const column of sortedColumns) {
      const cell = row.cells.find(c => c.columnId === column.id);
      let cellValue = '';
      
      if (cell) {
        if (exportType === 'formulas' && cell.formula) {
          cellValue = cell.formula;
        } else {
          cellValue = formatCellValueForCSV(cell.value);
        }
      }
      
      csvRow.push(escapeCSVValue(cellValue));
    }
    
    csvLines.push(csvRow.join(','));
  }

  return csvLines.join('\n');
}

/**
 * Generate CSV with both values and formulas (for includeFormulas=true option)
 */
export function generateEnhancedCSV(
  columns: { id: number; name: string; position: number }[],
  rows: Array<{ id: number; cells: Array<{ columnId: number; value: any; formula?: string }> }>
): { valuesCSV: string; formulasJSON: string } {
  const valuesCSV = generateCSV(columns, rows, { exportType: 'values' });
  
  // Generate formulas JSON
  const formulasData: Record<string, any> = {};
  
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.formula) {
        const column = columns.find(c => c.id === cell.columnId);
        if (column) {
          const cellRef = `${getColumnLetter(column.position)}${row.id}`;
          formulasData[cellRef] = cell.formula;
        }
      }
    }
  }
  
  const formulasJSON = JSON.stringify(formulasData, null, 2);
  
  return { valuesCSV, formulasJSON };
}

/**
 * Escape CSV value (handle quotes and commas)
 */
export function escapeCSVValue(value: string): string {
  const stringValue = value?.toString() || '';
  
  // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Format cell value for CSV export
 */
export function formatCellValueForCSV(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  
  return value.toString();
}

/**
 * Convert column position to Excel-style letter (1 -> A, 2 -> B, etc.)
 */
export function getColumnLetter(position: number): string {
  let result = '';
  let pos = position;
  
  while (pos > 0) {
    pos--;
    result = String.fromCharCode(65 + (pos % 26)) + result;
    pos = Math.floor(pos / 26);
  }
  
  return result;
}

/**
 * Detect column type based on sample values
 */
export function detectColumnType(values: string[]): CSVColumn['type'] {
  const nonEmptyValues = values.filter(v => v && v.trim());
  
  if (nonEmptyValues.length === 0) {
    return 'text';
  }

  // Check for email pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (nonEmptyValues.every(v => emailPattern.test(v))) {
    return 'email';
  }

  // Check for number pattern
  const numberPattern = /^-?\d+(\.\d+)?$/;
  if (nonEmptyValues.every(v => numberPattern.test(v))) {
    return 'number';
  }

  // Check for date pattern (basic)
  const datePattern = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}\.\d{2}\.\d{4}$/;
  if (nonEmptyValues.some(v => datePattern.test(v))) {
    return 'date';
  }

  // Check if it looks like a select (limited unique values)
  const uniqueValues = new Set(nonEmptyValues);
  if (uniqueValues.size <= Math.max(3, nonEmptyValues.length * 0.1)) {
    return 'select';
  }

  return 'text';
}

/**
 * Generate automatic column mapping suggestions
 */
export function generateColumnMapping(
  csvHeaders: string[],
  existingColumns: { id: number; name: string; position: number }[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  
  for (let i = 0; i < csvHeaders.length; i++) {
    const csvHeader = csvHeaders[i].trim();
    
    // Try to find exact match first
    let matchedColumn = existingColumns.find(col => 
      col.name.toLowerCase() === csvHeader.toLowerCase()
    );
    
    // Try partial match if no exact match
    if (!matchedColumn) {
      matchedColumn = existingColumns.find(col => 
        col.name.toLowerCase().includes(csvHeader.toLowerCase()) ||
        csvHeader.toLowerCase().includes(col.name.toLowerCase())
      );
    }
    
    mappings.push({
      csvColumnIndex: i,
      csvColumnName: csvHeader,
      tableColumnId: matchedColumn?.id || -1,
      tableColumnName: matchedColumn?.name || '',
      createNew: !matchedColumn
    });
  }
  
  return mappings;
}

/**
 * Validate CSV import data
 */
export function validateCSVImport(
  parseResult: CSVParseResult,
  columnMappings: ColumnMapping[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if we have data
  if (parseResult.totalRows === 0) {
    errors.push('CSV enthält keine Datenzeilen');
  }
  
  // Check if we have headers
  if (parseResult.headers.length === 0) {
    errors.push('CSV enthält keine Spaltenüberschriften');
  }
  
  // Check column mappings
  const validMappings = columnMappings.filter(m => m.tableColumnId > 0 || m.createNew);
  if (validMappings.length === 0) {
    errors.push('Es muss mindestens eine Spalte zugeordnet werden');
  }
  
  // Check for data consistency
  const expectedColumnCount = parseResult.headers.length;
  for (let i = 0; i < parseResult.rows.length; i++) {
    const row = parseResult.rows[i];
    if (row.length !== expectedColumnCount) {
      errors.push(`Zeile ${i + 2} hat ${row.length} Spalten, erwartet werden ${expectedColumnCount}`);
      break; // Only report first inconsistency
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}