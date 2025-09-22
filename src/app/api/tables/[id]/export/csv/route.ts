import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray, and } from 'drizzle-orm';
import { db } from '@/server/db';
import { tables, columns, rows, cells } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { generateCSV, generateEnhancedCSV } from '@/lib/csv-utils';

interface Params {
  params: {
    id: string;
  };
}

/**
 * GET /api/tables/[id]/export/csv - Export table data as CSV
 * Requires: view permission on table
 * Supports: JWT, API key, public slug access
 * 
 * Query Parameters:
 * - includeFormulas: true/false - If true, returns both CSV and JSON with formulas
 * - filename: string - Custom filename (without extension)
 * - exportType: 'values' | 'formulas' - Export computed values or formulas
 */
export async function GET(request: NextRequest, { params }: Params) {
  const tableId = parseInt(params.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const includeFormulas = searchParams.get('includeFormulas') === 'true';
  const customFilename = searchParams.get('filename') || '';
  const exportType = (searchParams.get('exportType') as 'values' | 'formulas') || 'values';

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'view'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    // Get table info
    const table = await db
      .select({
        id: tables.id,
        name: tables.name,
        updatedAt: tables.updatedAt
      })
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Get visible columns (ordered by position)
    const tableColumns = await db
      .select({
        id: columns.id,
        name: columns.name,
        type: columns.type,
        position: columns.position,
        isComputed: columns.isComputed
      })
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    if (tableColumns.length === 0) {
      return NextResponse.json({ error: 'Table has no columns' }, { status: 400 });
    }

    // Get all rows with their cells
    const tableRows = await db
      .select({
        id: rows.id,
        createdAt: rows.createdAt,
        updatedAt: rows.updatedAt
      })
      .from(rows)
      .where(eq(rows.tableId, tableId))
      .orderBy(rows.updatedAt);

    if (tableRows.length === 0) {
      // Return empty CSV with headers
      const headers = tableColumns.map(col => col.name);
      const csvContent = headers.map(h => `"${h}"`).join(',') + '\n';
      
      const filename = customFilename || `${table[0].name}_export`;
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
      });
    }

    // Get all cells for these rows
    const rowIdList = tableRows.map(r => r.id);
    const allCells = rowIdList.length > 0 ? await db
      .select({
        id: cells.id,
        rowId: cells.rowId,
        columnId: cells.columnId,
        valueJson: cells.valueJson,
        formula: cells.formula,
        errorCode: cells.errorCode
      })
      .from(cells)
      .where(inArray(cells.rowId, rowIdList)) : [];

    // Organize cells by row
    const cellsByRow = new Map<number, typeof allCells>();
    for (const cell of allCells) {
      if (!cellsByRow.has(cell.rowId)) {
        cellsByRow.set(cell.rowId, []);
      }
      cellsByRow.get(cell.rowId)!.push(cell);
    }

    // Transform data for CSV generation
    const exportData = tableRows.map(row => ({
      id: row.id,
      cells: tableColumns.map(column => {
        const cell = cellsByRow.get(row.id)?.find(c => c.columnId === column.id);
        let value = '';
        
        if (cell) {
          try {
            // Parse stored JSON value
            const parsedValue = cell.valueJson ? JSON.parse(cell.valueJson) : '';
            value = parsedValue;
          } catch (e) {
            // Fallback to raw value if JSON parsing fails
            value = cell.valueJson || '';
          }
        }
        
        return {
          columnId: column.id,
          value,
          formula: cell?.formula || undefined
        };
      })
    }));

    // Generate filename
    const baseFilename = customFilename || `${table[0].name}_export`;
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `${baseFilename}_${timestamp}`;

    // Handle different export types
    if (includeFormulas) {
      // Generate both CSV and formulas JSON
      const { valuesCSV, formulasJSON } = generateEnhancedCSV(tableColumns, exportData);
      
      // Return ZIP-like response with both files (or JSON with both)
      return NextResponse.json({
        files: {
          [`${filename}.csv`]: valuesCSV,
          [`${filename}_formulas.json`]: formulasJSON
        },
        metadata: {
          tableName: table[0].name,
          exportedAt: new Date().toISOString(),
          totalRows: tableRows.length,
          totalColumns: tableColumns.length,
          includesFormulas: true
        }
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}_complete.json"`
        }
      });
    } else {
      // Generate single CSV file
      const csvContent = generateCSV(tableColumns, exportData, { exportType });
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
          'X-Total-Rows': tableRows.length.toString(),
          'X-Total-Columns': tableColumns.length.toString(),
          'X-Export-Type': exportType,
          'X-Table-Name': encodeURIComponent(table[0].name)
        }
      });
    }

  } catch (error) {
    console.error('Error exporting CSV:', error);
    return NextResponse.json({ 
      error: 'Internal server error during CSV export'
    }, { status: 500 });
  }
}

/**
 * POST /api/tables/[id]/export/csv - Export filtered/selected data as CSV
 * Requires: view permission on table
 * Supports: JWT, API key (not public access)
 * 
 * Request Body:
 * - rowIds?: number[] - Specific row IDs to export
 * - columnIds?: number[] - Specific column IDs to export
 * - filters?: object - Applied filters
 * - filename?: string - Custom filename
 * - includeFormulas?: boolean
 */
export async function POST(request: NextRequest, { params }: Params) {
  const tableId = parseInt(params.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'view'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    const body = await request.json();
    const { 
      rowIds, 
      columnIds, 
      filename: customFilename, 
      includeFormulas = false,
      exportType = 'values'
    } = body;

    // Get table info
    const table = await db
      .select({
        id: tables.id,
        name: tables.name
      })
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Get columns (filtered if specified)
    let columnsQuery = db
      .select({
        id: columns.id,
        name: columns.name,
        type: columns.type,
        position: columns.position,
        isComputed: columns.isComputed
      })
      .from(columns)
      .where(eq(columns.tableId, tableId));
    
    const tableColumns = columnIds && columnIds.length > 0
      ? await db
          .select({
            id: columns.id,
            name: columns.name,
            type: columns.type,
            position: columns.position,
            isComputed: columns.isComputed
          })
          .from(columns)
          .where(and(
            eq(columns.tableId, tableId),
            inArray(columns.id, columnIds)
          ))
          .orderBy(columns.position)
      : await db
          .select({
            id: columns.id,
            name: columns.name,
            type: columns.type,
            position: columns.position,
            isComputed: columns.isComputed
          })
          .from(columns)
          .where(eq(columns.tableId, tableId))
          .orderBy(columns.position);
    
    // Get rows (filtered if specified)
    const tableRows = rowIds && rowIds.length > 0
      ? await db
          .select({
            id: rows.id,
            createdAt: rows.createdAt,
            updatedAt: rows.updatedAt
          })
          .from(rows)
          .where(and(
            eq(rows.tableId, tableId),
            inArray(rows.id, rowIds)
          ))
          .orderBy(rows.updatedAt)
      : await db
          .select({
            id: rows.id,
            createdAt: rows.createdAt,
            updatedAt: rows.updatedAt
          })
          .from(rows)
          .where(eq(rows.tableId, tableId))
          .orderBy(rows.updatedAt);

    if (tableRows.length === 0) {
      return NextResponse.json({ error: 'No rows to export' }, { status: 400 });
    }

    // Get cells for selected rows and columns
    const rowIdList = tableRows.map((r: { id: number }) => r.id);
    const allCells = rowIdList.length > 0 ? await db
      .select({
        rowId: cells.rowId,
        columnId: cells.columnId,
        valueJson: cells.valueJson,
        formula: cells.formula
      })
      .from(cells)
      .where(inArray(cells.rowId, rowIdList)) : [];

    // Organize and transform data
    const cellsByRow = new Map<number, typeof allCells>();
    for (const cell of allCells) {
      if (!cellsByRow.has(cell.rowId)) {
        cellsByRow.set(cell.rowId, []);
      }
      cellsByRow.get(cell.rowId)!.push(cell);
    }

    const exportData = tableRows.map((row: { id: number }) => ({
      id: row.id,
      cells: tableColumns.map((column: { id: number }) => {
        const cell = cellsByRow.get(row.id)?.find(c => c.columnId === column.id);
        let value = '';
        
        if (cell) {
          try {
            value = cell.valueJson ? JSON.parse(cell.valueJson) : '';
          } catch (e) {
            value = cell.valueJson || '';
          }
        }
        
        return {
          columnId: column.id,
          value,
          formula: cell?.formula || undefined
        };
      })
    }));

    // Generate CSV
    const csvContent = generateCSV(tableColumns, exportData, { exportType });
    
    const baseFilename = customFilename || `${table[0].name}_filtered_export`;
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${baseFilename}_${timestamp}`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
        'X-Total-Rows': tableRows.length.toString(),
        'X-Total-Columns': tableColumns.length.toString(),
        'X-Export-Type': exportType
      }
    });

  } catch (error) {
    console.error('Error exporting filtered CSV:', error);
    return NextResponse.json({ 
      error: 'Internal server error during CSV export' 
    }, { status: 500 });
  }
}