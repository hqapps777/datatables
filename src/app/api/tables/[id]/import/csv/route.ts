import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { tables, columns, rows, cells } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { parseCSV, detectColumnType, generateColumnMapping, validateCSVImport, ColumnMapping } from '@/lib/csv-utils';

interface Params {
  params: {
    id: string;
  };
}

/**
 * POST /api/tables/[id]/import/csv - Import CSV data into table
 * Requires: edit permission on table
 * Supports: JWT, API key (not public access)
 */
export async function POST(request: NextRequest, { params }: Params) {
  const tableId = parseInt(params.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'edit'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mappingsParam = formData.get('mappings') as string | null;
    const createMissingColumns = formData.get('createMissingColumns') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'CSV-Datei ist erforderlich' }, { status: 400 });
    }

    // Read file content
    const csvContent = await file.text();
    
    if (!csvContent.trim()) {
      return NextResponse.json({ error: 'CSV-Datei ist leer' }, { status: 400 });
    }

    // Parse CSV content
    const parseResult = parseCSV(csvContent);

    // Get existing table structure
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    const existingColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    // Handle column mappings
    let columnMappings: ColumnMapping[] = [];
    
    if (mappingsParam) {
      // Use provided mappings
      try {
        columnMappings = JSON.parse(mappingsParam);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid column mappings format' }, { status: 400 });
      }
    } else {
      // Generate automatic mappings
      columnMappings = generateColumnMapping(parseResult.headers, existingColumns);
    }

    // Validate the import
    const validation = validateCSVImport(parseResult, columnMappings);
    if (!validation.isValid) {
      return NextResponse.json({ 
        error: 'CSV-Import-Validierung fehlgeschlagen',
        details: validation.errors
      }, { status: 400 });
    }

    // Create missing columns if requested and allowed
    const columnsToCreate = columnMappings.filter(m => m.createNew && createMissingColumns);
    const createdColumnIds = new Map<string, number>();

    for (const mapping of columnsToCreate) {
      // Detect column type from sample data
      const sampleValues = parseResult.rows
        .slice(0, 10)
        .map(row => row[mapping.csvColumnIndex] || '')
        .filter(v => v.trim());
      
      const detectedType = detectColumnType(sampleValues);
      const nextPosition = Math.max(...existingColumns.map(c => c.position), 0) + Object.keys(createdColumnIds).length + 1;

      const [newColumn] = await db
        .insert(columns)
        .values({
          tableId,
          name: mapping.csvColumnName,
          type: detectedType,
          position: nextPosition,
          isComputed: false
        })
        .returning();

      createdColumnIds.set(mapping.csvColumnName, newColumn.id);
      
      // Update mapping with new column ID
      mapping.tableColumnId = newColumn.id;
      mapping.tableColumnName = newColumn.name;
      mapping.createNew = false;
    }

    // Filter valid mappings (existing columns + newly created ones)
    const validMappings = columnMappings.filter(m => m.tableColumnId > 0);

    // Import data rows
    let importedRowCount = 0;
    let errorRows: Array<{ rowIndex: number; error: string }> = [];

    await db.transaction(async (tx) => {
      for (let rowIndex = 0; rowIndex < parseResult.rows.length; rowIndex++) {
        const csvRow = parseResult.rows[rowIndex];
        
        try {
          // Create new row
          const [newRow] = await tx
            .insert(rows)
            .values({
              tableId,
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .returning();

          // Insert cells for each mapped column
          const cellInserts = validMappings
            .map(mapping => {
              const csvValue = csvRow[mapping.csvColumnIndex] || '';
              let processedValue: any = csvValue;

              // Basic type conversion
              const column = existingColumns.find(c => c.id === mapping.tableColumnId) || 
                           { type: 'text' }; // Default for new columns

              if (column.type === 'number' && csvValue.trim()) {
                const numValue = parseFloat(csvValue);
                if (!isNaN(numValue)) {
                  processedValue = numValue;
                }
              } else if (column.type === 'select' && csvValue.trim()) {
                // Keep as string for select types
                processedValue = csvValue.trim();
              }

              return {
                rowId: newRow.id,
                columnId: mapping.tableColumnId,
                valueJson: JSON.stringify(processedValue),
                calcVersion: 0
              };
            })
            .filter(cell => cell.valueJson !== '""'); // Skip empty cells

          if (cellInserts.length > 0) {
            await tx.insert(cells).values(cellInserts);
          }

          importedRowCount++;
        } catch (error) {
          errorRows.push({
            rowIndex: rowIndex + 2, // +2 because CSV is 1-based and we skip header
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    });

    // Update table timestamp
    await db
      .update(tables)
      .set({ updatedAt: new Date() })
      .where(eq(tables.id, tableId));

    return NextResponse.json({
      success: true,
      message: `${importedRowCount} Zeilen erfolgreich importiert`,
      summary: {
        totalRows: parseResult.totalRows,
        importedRows: importedRowCount,
        skippedRows: errorRows.length,
        createdColumns: Object.keys(createdColumnIds).length,
        processedMappings: validMappings.length
      },
      createdColumns: Object.fromEntries(createdColumnIds),
      errors: errorRows.length > 0 ? errorRows.slice(0, 10) : undefined // Limit error reporting
    });

  } catch (error) {
    console.error('Error importing CSV:', error);
    
    if (error instanceof Error && error.message.includes('CSV')) {
      return NextResponse.json({ 
        error: 'CSV-Parsing-Fehler',
        details: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error during CSV import' 
    }, { status: 500 });
  }
}

/**
 * GET /api/tables/[id]/import/csv - Get CSV import preview (for mapping dialog)
 * Requires: view permission on table
 */
export async function GET(request: NextRequest, { params }: Params) {
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
    // This endpoint is for getting table structure to help with CSV mapping
    const existingColumns = await db
      .select({
        id: columns.id,
        name: columns.name,
        type: columns.type,
        position: columns.position
      })
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    return NextResponse.json({
      tableId,
      columns: existingColumns
    });

  } catch (error) {
    console.error('Error getting table structure for CSV import:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}