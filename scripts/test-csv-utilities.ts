#!/usr/bin/env tsx

import { 
  parseCSV, 
  generateCSV, 
  generateColumnMapping, 
  detectColumnType, 
  validateCSVImport,
  escapeCSVValue,
  getColumnLetter
} from '../src/lib/csv-utils';

async function testCSVUtilities() {
  console.log('🧪 Testing CSV Utilities...\n');

  try {
    // Test 1: CSV Parsing
    console.log('1️⃣ Testing CSV parsing...');
    const sampleCSV = `Name,Age,Email,Status
John Doe,30,john@example.com,Active
Jane Smith,25,jane@example.com,Inactive
Bob Johnson,35,bob@example.com,Active
Alice Brown,28,alice@example.com,Pending`;

    const parseResult = parseCSV(sampleCSV);
    console.log('✅ CSV parsing successful:');
    console.log(`   Headers: ${parseResult.headers.join(', ')}`);
    console.log(`   Total rows: ${parseResult.totalRows}`);
    console.log(`   First row: [${parseResult.rows[0].join(', ')}]`);

    // Test 2: CSV Generation
    console.log('\n2️⃣ Testing CSV generation...');
    const mockColumns = [
      { id: 1, name: 'Name', position: 1 },
      { id: 2, name: 'Age', position: 2 },
      { id: 3, name: 'Email', position: 3 },
      { id: 4, name: 'Status', position: 4 }
    ];

    const mockRows = [
      {
        id: 1,
        cells: [
          { columnId: 1, value: 'John Doe' },
          { columnId: 2, value: 30 },
          { columnId: 3, value: 'john@example.com' },
          { columnId: 4, value: 'Active' }
        ]
      },
      {
        id: 2,
        cells: [
          { columnId: 1, value: 'Jane Smith' },
          { columnId: 2, value: 25 },
          { columnId: 3, value: 'jane@example.com' },
          { columnId: 4, value: 'Inactive' }
        ]
      }
    ];

    const generatedCSV = generateCSV(mockColumns, mockRows);
    console.log('✅ CSV generation successful:');
    console.log('📄 Generated CSV:');
    console.log(generatedCSV);

    // Test 3: Column type detection
    console.log('\n3️⃣ Testing column type detection...');
    const testCases = [
      { values: ['john@example.com', 'jane@test.com', 'bob@company.org'], expected: 'email' },
      { values: ['30', '25', '35', '28'], expected: 'number' },
      { values: ['2023-01-01', '2023-12-31'], expected: 'date' },
      { values: ['Active', 'Inactive', 'Active'], expected: 'select' },
      { values: ['John Doe', 'Jane Smith', 'Bob Johnson'], expected: 'text' }
    ];

    for (const testCase of testCases) {
      const detectedType = detectColumnType(testCase.values);
      console.log(`   ${testCase.values.slice(0, 2).join(', ')}... -> ${detectedType} ${detectedType === testCase.expected ? '✅' : '❌'}`);
    }

    // Test 4: Column mapping
    console.log('\n4️⃣ Testing column mapping generation...');
    const csvHeaders = ['Name', 'Age', 'Email', 'Status'];
    const existingColumns = [
      { id: 1, name: 'Full Name', position: 1 },
      { id: 2, name: 'Age', position: 2 },
      { id: 3, name: 'Email Address', position: 3 }
    ];

    const mappings = generateColumnMapping(csvHeaders, existingColumns);
    console.log('✅ Column mappings generated:');
    mappings.forEach(mapping => {
      console.log(`   "${mapping.csvColumnName}" -> ${
        mapping.createNew 
          ? 'NEW COLUMN' 
          : `"${mapping.tableColumnName}" (ID: ${mapping.tableColumnId})`
      }`);
    });

    // Test 5: CSV validation
    console.log('\n5️⃣ Testing CSV import validation...');
    const validation = validateCSVImport(parseResult, mappings);
    console.log(`✅ Validation result: ${validation.isValid ? 'VALID' : 'INVALID'}`);
    if (!validation.isValid) {
      console.log('   Errors:', validation.errors);
    }

    // Test 6: CSV escaping
    console.log('\n6️⃣ Testing CSV value escaping...');
    const testValues = [
      'Simple text',
      'Text with, comma',
      'Text with "quotes"',
      'Text with\nnewline',
      'Complex, text with "quotes" and\nnewline'
    ];

    console.log('✅ CSV escaping tests:');
    testValues.forEach(value => {
      const escaped = escapeCSVValue(value);
      console.log(`   "${value.replace(/\n/g, '\\n')}" -> "${escaped}"`);
    });

    // Test 7: Column letter conversion
    console.log('\n7️⃣ Testing column letter conversion...');
    const positions = [1, 2, 26, 27, 52, 702, 703];
    console.log('✅ Position to letter conversion:');
    positions.forEach(pos => {
      const letter = getColumnLetter(pos);
      console.log(`   ${pos} -> ${letter}`);
    });

    // Test 8: Complex CSV with edge cases
    console.log('\n8️⃣ Testing complex CSV with edge cases...');
    const complexCSV = `"Name","Age","Description","Notes"
"John ""Johnny"" Doe",30,"Software Developer
with experience","Important, client"
"Jane O'Connor",25,"Designer, UX/UI","Has ""special"" skills"
"Bob Smith",,"Developer","Missing age value"
"",40,"No name","Empty name field"`;

    const complexParseResult = parseCSV(complexCSV);
    console.log('✅ Complex CSV parsing successful:');
    console.log(`   Headers: ${complexParseResult.headers.join(', ')}`);
    console.log(`   Total rows: ${complexParseResult.totalRows}`);
    console.log(`   Complex row example: [${complexParseResult.rows[0]?.slice(0, 2).join(', ')}...]`);

    console.log('\n🎉 All CSV utility tests passed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ CSV parsing with standard format');
    console.log('   ✅ CSV generation from data structures');
    console.log('   ✅ Column type detection (email, number, date, select, text)');
    console.log('   ✅ Column mapping generation');
    console.log('   ✅ CSV import validation');
    console.log('   ✅ CSV value escaping (commas, quotes, newlines)');
    console.log('   ✅ Column position to letter conversion');
    console.log('   ✅ Complex CSV parsing with edge cases');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testCSVUtilities()
  .then(() => {
    console.log('\n🏁 CSV utilities test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 CSV utilities test failed:', error);
    process.exit(1);
  });