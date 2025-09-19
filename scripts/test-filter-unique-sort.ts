import { HyperFormula, ConfigParams } from 'hyperformula';

/**
 * Test HyperFormula native support for FILTER, UNIQUE, SORT and volatile functions
 */
class FilterUniqueSortTest {
  private hf: HyperFormula;
  private sheetId: number = 0;

  constructor() {
    const config: Partial<ConfigParams> = {
      licenseKey: 'gpl-v3',
      useColumnIndex: true,
      functionArgSeparator: ',',
      smartRounding: true,
    };

    this.hf = HyperFormula.buildEmpty(config);
    this.hf.addSheet('Test');
    this.sheetId = 0;
  }

  setupTestData() {
    console.log('Setting up test data for FILTER/UNIQUE/SORT...');
    
    // Create test data with duplicates and various values
    const testData = [
      ['Name', 'Category', 'Price', 'Quantity'],     // A1:D1 (headers)
      ['Apple', 'Fruit', 1.50, 10],                 // A2:D2
      ['Banana', 'Fruit', 0.80, 15],                // A3:D3
      ['Apple', 'Fruit', 1.50, 5],                  // A4:D4 (duplicate)
      ['Carrot', 'Vegetable', 2.00, 8],             // A5:D5
      ['Broccoli', 'Vegetable', 3.50, 12],          // A6:D6
      ['Apple', 'Fruit', 1.50, 20],                 // A7:D7 (another duplicate)
      ['Lettuce', 'Vegetable', 1.20, 25],           // A8:D8
      ['Banana', 'Fruit', 0.80, 30],                // A9:D9 (duplicate)
      ['Orange', 'Fruit', 1.80, 18],                // A10:D10
    ];
    
    this.hf.setSheetContent(this.sheetId, testData);
    
    console.log('✅ Test data setup complete');
    console.log('- Data contains duplicates for testing UNIQUE function');
    console.log('- Data has different categories for testing FILTER function');
    console.log('- Data has numeric values for testing SORT function');
    
    // Display the data
    console.log('\nTest data:');
    for (let row = 0; row < testData.length; row++) {
      console.log(`Row ${row + 1}: ${JSON.stringify(testData[row])}`);
    }
  }

  testFILTERFunction() {
    console.log('\n=== Testing FILTER Function ===');
    
    const filterTests = [
      {
        name: 'FILTER Basic Syntax',
        formula: '=FILTER(A2:A10, B2:B10="Fruit")',
        description: 'Filter names where category is Fruit'
      },
      {
        name: 'FILTER with Condition',
        formula: '=FILTER(A2:D10, C2:C10>1.5)',
        description: 'Filter all columns where price > 1.5'
      },
      {
        name: 'FILTER Range',
        formula: '=FILTER(A:A, B:B="Fruit")',
        description: 'Filter entire column A where column B is Fruit'
      }
    ];

    filterTests.forEach((test, index) => {
      try {
        console.log(`\n${test.name}:`);
        console.log(`  Formula: ${test.formula}`);
        console.log(`  Description: ${test.description}`);
        
        // Use column F for testing
        const testRow = index + 1;
        this.hf.setCellContents({ sheet: this.sheetId, row: testRow, col: 5 }, test.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: testRow, col: 5 });
        
        console.log(`  Result: ${JSON.stringify(result)}`);
        
        if (typeof result === 'object' && result && 'error' in result) {
          console.log('  ❌ Function not supported or syntax error');
        } else {
          console.log('  ✅ Function appears to work');
        }
        
      } catch (error) {
        console.log(`  ❌ Exception: ${error}`);
      }
    });
  }

  testUNIQUEFunction() {
    console.log('\n=== Testing UNIQUE Function ===');
    
    const uniqueTests = [
      {
        name: 'UNIQUE Basic',
        formula: '=UNIQUE(A2:A10)',
        description: 'Get unique values from name column'
      },
      {
        name: 'UNIQUE Entire Column',
        formula: '=UNIQUE(A:A)',
        description: 'Get unique values from entire column A'
      },
      {
        name: 'UNIQUE Multiple Columns',
        formula: '=UNIQUE(A2:B10)',
        description: 'Get unique combinations of name and category'
      }
    ];

    uniqueTests.forEach((test, index) => {
      try {
        console.log(`\n${test.name}:`);
        console.log(`  Formula: ${test.formula}`);
        console.log(`  Description: ${test.description}`);
        
        // Use column G for testing
        const testRow = index + 1;
        this.hf.setCellContents({ sheet: this.sheetId, row: testRow, col: 6 }, test.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: testRow, col: 6 });
        
        console.log(`  Result: ${JSON.stringify(result)}`);
        
        if (typeof result === 'object' && result && 'error' in result) {
          console.log('  ❌ Function not supported or syntax error');
        } else {
          console.log('  ✅ Function appears to work');
        }
        
      } catch (error) {
        console.log(`  ❌ Exception: ${error}`);
      }
    });
  }

  testSORTFunction() {
    console.log('\n=== Testing SORT Function ===');
    
    const sortTests = [
      {
        name: 'SORT Basic',
        formula: '=SORT(A2:A10)',
        description: 'Sort names alphabetically'
      },
      {
        name: 'SORT Descending',
        formula: '=SORT(C2:C10, 1, FALSE)',
        description: 'Sort prices in descending order'
      },
      {
        name: 'SORT Multiple Columns',
        formula: '=SORT(A2:D10, 2, TRUE)',
        description: 'Sort entire range by category (column 2)'
      }
    ];

    sortTests.forEach((test, index) => {
      try {
        console.log(`\n${test.name}:`);
        console.log(`  Formula: ${test.formula}`);
        console.log(`  Description: ${test.description}`);
        
        // Use column H for testing
        const testRow = index + 1;
        this.hf.setCellContents({ sheet: this.sheetId, row: testRow, col: 7 }, test.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: testRow, col: 7 });
        
        console.log(`  Result: ${JSON.stringify(result)}`);
        
        if (typeof result === 'object' && result && 'error' in result) {
          console.log('  ❌ Function not supported or syntax error');
        } else {
          console.log('  ✅ Function appears to work');
        }
        
      } catch (error) {
        console.log(`  ❌ Exception: ${error}`);
      }
    });
  }

  testVolatileFunctions() {
    console.log('\n=== Testing Volatile Functions (NOW, TODAY) ===');
    
    const volatileTests = [
      {
        name: 'NOW Function',
        formula: '=NOW()',
        description: 'Current date and time'
      },
      {
        name: 'TODAY Function',
        formula: '=TODAY()',
        description: 'Current date only'
      },
      {
        name: 'NOW Formatting',
        formula: '=TEXT(NOW(), "yyyy-mm-dd hh:mm:ss")',
        description: 'Format NOW() as text'
      }
    ];

    const initialResults: any[] = [];
    
    // Test initial values
    volatileTests.forEach((test, index) => {
      try {
        console.log(`\n${test.name} (Initial):`);
        console.log(`  Formula: ${test.formula}`);
        console.log(`  Description: ${test.description}`);
        
        // Use column I for testing
        const testRow = index + 1;
        this.hf.setCellContents({ sheet: this.sheetId, row: testRow, col: 8 }, test.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: testRow, col: 8 });
        
        console.log(`  Result: ${JSON.stringify(result)}`);
        initialResults[index] = result;
        
        if (typeof result === 'object' && result && 'error' in result) {
          console.log('  ❌ Function not supported or syntax error');
        } else {
          console.log('  ✅ Function appears to work');
        }
        
      } catch (error) {
        console.log(`  ❌ Exception: ${error}`);
        initialResults[index] = null;
      }
    });

    // Wait a moment and test again to see if values are volatile
    console.log('\n--- Waiting 2 seconds and re-evaluating to test volatility ---');
    
    setTimeout(() => {
      volatileTests.forEach((test, index) => {
        try {
          console.log(`\n${test.name} (After delay):`);
          
          const testRow = index + 1;
          // Force recalculation by setting the formula again
          this.hf.setCellContents({ sheet: this.sheetId, row: testRow, col: 8 }, test.formula);
          const result = this.hf.getCellValue({ sheet: this.sheetId, row: testRow, col: 8 });
          
          console.log(`  Previous: ${JSON.stringify(initialResults[index])}`);
          console.log(`  Current: ${JSON.stringify(result)}`);
          
          if (result !== initialResults[index]) {
            console.log('  ✅ Function is volatile (value changed)');
          } else {
            console.log('  ⚠️  Function may not be volatile or needs manual recalc');
          }
          
        } catch (error) {
          console.log(`  ❌ Exception: ${error}`);
        }
      });
      
      this.printSummary();
    }, 2000);
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FILTER/UNIQUE/SORT Function Support Summary');
    console.log('='.repeat(60));
    console.log('Based on the tests above:');
    console.log('• FILTER: Check if natively supported or needs custom implementation');
    console.log('• UNIQUE: Check if natively supported or needs custom implementation');
    console.log('• SORT: Check if natively supported or needs custom implementation');
    console.log('• NOW/TODAY: Check if volatile behavior works correctly');
    console.log('\nIf functions show #NAME? errors, they need custom implementation.');
    console.log('If functions work but aren\'t volatile, manual recalc system needed.');
  }

  cleanup() {
    this.hf.destroy();
  }

  async runAllTests() {
    console.log('🔧 Testing FILTER / UNIQUE / SORT / Volatile Functions in HyperFormula...\n');
    
    try {
      this.setupTestData();
      this.testFILTERFunction();
      this.testUNIQUEFunction();
      this.testSORTFunction();
      this.testVolatileFunctions();
      
      // Note: printSummary is called from within testVolatileFunctions after delay
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      this.cleanup();
    }
  }
}

// Run tests
const testSuite = new FilterUniqueSortTest();
testSuite.runAllTests().catch(console.error);