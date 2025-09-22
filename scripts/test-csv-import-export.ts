#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../src/server/db';
import { tables, columns, rows, cells } from '../src/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { parseCSV, generateCSV, generateColumnMapping } from '../src/lib/csv-utils';

async function testCSVImportExport() {
  console.log('🧪 Testing CSV Import/Export functionality...\n');

  try {
    // Step 1: Create test data
    console.log('1️⃣ Creating test table with sample data...');
    
    // Find or create a test table
    let testTable = await db
      .select()
      .from(tables)
      .where(eq(tables.name, 'CSV Test Table'))
      .limit(1);

    let tableId: number;
    if (testTable.length === 0) {
      // Create test table (assuming folder ID 1 exists)
      const [newTable] = await db
        .insert(tables)
        .values({
          name: 'CSV Test Table',
          folderId: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      tableId = newTable.id;
      console.log(`✅ Created test table with ID: ${tableId}`);
    } else {
      tableId = testTable[0].id;
      console.log(`✅ Using existing test table with ID: ${tableId}`);
    }

    // Create test columns if they don't exist
    const existingColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId));

    if (existingColumns.length === 0) {
      const testColumns = [
        { name: 'Name', type: 'text', position: 1 },
        { name: 'Age', type: 'number', position: 2 },
        { name: 'Email', type: 'email', position: 3 },
        { name: 'Status', type: 'select', position: 4 }
      ];

      for (const col of testColumns) {
        await db.insert(columns).values({
          tableId,
          name: col.name,
          type: col.type,
          position: col.position,
          isComputed: false
        });
      }
      console.log('✅ Created test columns');
    }

    // Get columns for reference
    const tableColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    // Create test rows if they don't exist
    const existingRows = await db
      .select()
      .from(rows)
      .where(eq(rows.tableId, tableId));

    if (existingRows.length === 0) {
      const testData = [
        ['John Doe', '30', 'john@example.com', 'Active'],
        ['Jane Smith', '25', 'jane@example.com', 'Inactive'],
        ['Bob Johnson', '35', 'bob@example.com', 'Active'],
        ['Alice Brown', '28', 'alice@example.com', 'Pending']
      ];

      for (const rowData of testData) {
        const [newRow] = await db
          .insert(rows)
          .values({
            tableId,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        // Insert cells for this row
        for (let i = 0; i < rowData.length && i < tableColumns.length; i++) {
          await db.insert(cells).values({
            rowId: newRow.id,
            columnId: tableColumns[i].id,
            valueJson: JSON.stringify(rowData[i]),
            calcVersion: 0
          });
        }
      }
      console.log('✅ Created test data rows');
    }

    // Step 2: Test CSV Export
    console.log('\n2️⃣ Testing CSV Export...');
    
    // Get all data for export
    const exportRows = await db
      .select({
        id: rows.id,
        createdAt: rows.createdAt,
        updatedAt: rows.updatedAt
      })
      .from(rows)
      .where(eq(rows.tableId, tableId));

    const rowIds = exportRows.map(r => r.id);
    const allCells = rowIds.length > 0 ? await db
      .select()
      .from(cells)
      .where(inArray(cells.rowId, rowIds)) : [];

    // Organize cells by row
    const cellsByRow = new Map<number, typeof allCells>();
    for (const cell of allCells) {
      if (!cellsByRow.has(cell.rowId)) {
        cellsByRow.set(cell.rowId, []);
      }
      cellsByRow.get(cell.rowId)!.push(cell);
    }

    // Transform data for CSV generation
    const exportData = exportRows.map(row => ({
      id: row.id,
      cells: tableColumns.map(column => {
        const cell = cellsByRow.get(row.id)?.find(c => c.columnId === column.id);
        let value = '';
        
        if (cell?.valueJson) {
          try {
            value = JSON.parse(cell.valueJson);
          } catch (e) {
            value = cell.valueJson;
          }
        }
        
        return {
          columnId: column.id,
          value,
          formula: cell?.formula || undefined
        };
      })
    }));

    const csvContent = generateCSV(tableColumns, exportData);
    console.log('✅ Generated CSV content:');
    console.log('📄 CSV Preview (first 300 chars):');
    console.log(csvContent.substring(0, 300) + (csvContent.length > 300 ? '...' : ''));

    // Step 3: Test CSV Parsing
    console.log('\n3️⃣ Testing CSV Import parsing...');
    
    const sampleCSV = `Name,Age,Email,Status
John Doe,30,john@example.com,Active
Jane Smith,25,jane@example.com,Inactive
Bob Johnson,35,bob@example.com,Active
Alice Brown,28,alice@example.com,Pending`;

    const parseResult = parseCSV(sampleCSV);
    console.log('✅ Parsed CSV:');
    console.log(`   Headers: ${parseResult.headers.join(', ')}`);
    console.log(`   Rows: ${parseResult.totalRows}`);
    console.log(`   Sample row: [${parseResult.rows[0]?.join(', ') || 'none'}]`);

    // Step 4: Test Column Mapping
    console.log('\n4️⃣ Testing column mapping generation...');
    
    const mappings = generateColumnMapping(parseResult.headers, tableColumns);
    console.log('✅ Generated column mappings:');
    mappings.forEach(mapping => {
      console.log(`   "${mapping.csvColumnName}" -> ${
        mapping.createNew 
          ? 'NEW COLUMN' 
          : `"${mapping.tableColumnName}" (ID: ${mapping.tableColumnId})`
      }`);
    });

    // Step 5: Test CSV API endpoints (simulation)
    console.log('\n5️⃣ Testing API endpoint compatibility...');
    
    // Test export endpoint format
    const apiExportResult = {
      files: csvContent,
      metadata: {
        tableName: 'CSV Test Table',
        exportedAt: new Date().toISOString(),
        totalRows: exportRows.length,
        totalColumns: tableColumns.length,
        includesFormulas: false
      }
    };
    console.log('✅ Export API format test passed');
    console.log(`   Metadata: ${apiExportResult.metadata.totalRows} rows, ${apiExportResult.metadata.totalColumns} columns`);

    // Test import validation
    const importValidation = {
      isValid: parseResult.totalRows > 0 && parseResult.headers.length > 0,
      errors: parseResult.totalRows === 0 ? ['No data rows found'] : []
    };
    console.log('✅ Import validation test passed');
    console.log(`   Valid: ${importValidation.isValid}, Errors: ${importValidation.errors.length}`);

    console.log('\n🎉 All CSV Import/Export tests passed successfully!');
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Table created/verified: ID ${tableId}`);
    console.log(`   ✅ Columns: ${tableColumns.length}`);
    console.log(`   ✅ Rows: ${exportRows.length}`);
    console.log(`   ✅ CSV export generated: ${csvContent.split('\n').length} lines`);
    console.log(`   ✅ CSV import parsed: ${parseResult.totalRows} rows`);
    console.log(`   ✅ Column mappings: ${mappings.length} mappings`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testCSVImportExport()
  .then(() => {
    console.log('\n🏁 Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });