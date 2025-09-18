import { HyperFormula, ConfigParams } from 'hyperformula';

/**
 * Test script to check VLOOKUP, INDEX, MATCH support in HyperFormula
 */
class LookupFunctionTest {
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
    this.hf.addSheet('test');
    this.sheetId = 0;
  }

  setupTestData() {
    console.log('Setting up test data...');
    
    // Create lookup table in A1:C5
    const lookupData = [
      ['Product', 'Price', 'Category'],     // A1:C1 (headers)
      ['Apple', 1.50, 'Fruit'],            // A2:C2
      ['Banana', 0.80, 'Fruit'],           // A3:C3
      ['Carrot', 2.00, 'Vegetable'],       // A4:C4
      ['Broccoli', 3.50, 'Vegetable'],     // A5:C5
    ];

    // Set the data in the sheet
    this.hf.setSheetContent(this.sheetId, lookupData);
    
    console.log('Test data set up:');
    console.log('A1:C5 contains lookup table with Product, Price, Category');
  }

  testVLOOKUP() {
    console.log('\n=== Testing VLOOKUP Function ===');
    
    const testCases = [
      {
        formula: '=VLOOKUP("Apple", A1:C5, 2, FALSE)',
        description: 'VLOOKUP Apple price (exact match)'
      },
      {
        formula: '=VLOOKUP("Banana", A1:C5, 3, FALSE)',
        description: 'VLOOKUP Banana category (exact match)'
      },
      {
        formula: '=VLOOKUP("Apple", A1:C5, 2, TRUE)',
        description: 'VLOOKUP Apple price (approximate match)'
      },
      {
        formula: '=VLOOKUP("NotFound", A1:C5, 2, FALSE)',
        description: 'VLOOKUP non-existent item (should return #N/A)'
      }
    ];

    testCases.forEach((testCase, index) => {
      try {
        const testCell = `E${index + 1}`;
        this.hf.setCellContents({ sheet: this.sheetId, row: index, col: 4 }, testCase.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: index, col: 4 });
        
        console.log(`${testCase.description}:`);
        console.log(`  Formula: ${testCase.formula}`);
        console.log(`  Result: ${JSON.stringify(result)}`);
        console.log('');
      } catch (error) {
        console.log(`❌ ${testCase.description} failed: ${error}`);
      }
    });
  }

  testINDEX() {
    console.log('\n=== Testing INDEX Function ===');
    
    const testCases = [
      {
        formula: '=INDEX(A1:C5, 2, 2)',
        description: 'INDEX row 2, column 2 (Apple price)'
      },
      {
        formula: '=INDEX(A1:C5, 3, 1)',
        description: 'INDEX row 3, column 1 (Banana name)'
      },
      {
        formula: '=INDEX(B1:B5, 4)',
        description: 'INDEX single column, row 4'
      }
    ];

    testCases.forEach((testCase, index) => {
      try {
        const testCell = `F${index + 1}`;
        this.hf.setCellContents({ sheet: this.sheetId, row: index, col: 5 }, testCase.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: index, col: 5 });
        
        console.log(`${testCase.description}:`);
        console.log(`  Formula: ${testCase.formula}`);
        console.log(`  Result: ${JSON.stringify(result)}`);
        console.log('');
      } catch (error) {
        console.log(`❌ ${testCase.description} failed: ${error}`);
      }
    });
  }

  testMATCH() {
    console.log('\n=== Testing MATCH Function ===');
    
    const testCases = [
      {
        formula: '=MATCH("Apple", A1:A5, 0)',
        description: 'MATCH Apple (exact match)'
      },
      {
        formula: '=MATCH("Banana", A1:A5, 0)',
        description: 'MATCH Banana (exact match)'
      },
      {
        formula: '=MATCH(2.00, B1:B5, 0)',
        description: 'MATCH price 2.00 (exact match)'
      },
      {
        formula: '=MATCH("NotFound", A1:A5, 0)',
        description: 'MATCH non-existent item (should return #N/A)'
      }
    ];

    testCases.forEach((testCase, index) => {
      try {
        const testCell = `G${index + 1}`;
        this.hf.setCellContents({ sheet: this.sheetId, row: index, col: 6 }, testCase.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: index, col: 6 });
        
        console.log(`${testCase.description}:`);
        console.log(`  Formula: ${testCase.formula}`);
        console.log(`  Result: ${JSON.stringify(result)}`);
        console.log('');
      } catch (error) {
        console.log(`❌ ${testCase.description} failed: ${error}`);
      }
    });
  }

  testINDEXMATCH() {
    console.log('\n=== Testing INDEX+MATCH Combination ===');
    
    const testCases = [
      {
        formula: '=INDEX(B1:B5, MATCH("Apple", A1:A5, 0))',
        description: 'INDEX+MATCH Apple price (equivalent to VLOOKUP)'
      },
      {
        formula: '=INDEX(C1:C5, MATCH("Banana", A1:A5, 0))',
        description: 'INDEX+MATCH Banana category (equivalent to VLOOKUP)'
      }
    ];

    testCases.forEach((testCase, index) => {
      try {
        const testCell = `H${index + 1}`;
        this.hf.setCellContents({ sheet: this.sheetId, row: index, col: 7 }, testCase.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: index, col: 7 });
        
        console.log(`${testCase.description}:`);
        console.log(`  Formula: ${testCase.formula}`);
        console.log(`  Result: ${JSON.stringify(result)}`);
        console.log('');
      } catch (error) {
        console.log(`❌ ${testCase.description} failed: ${error}`);
      }
    });
  }

  testCrossTableReferences() {
    console.log('\n=== Testing Cross-Table References ===');
    
    // Add a second sheet
    this.hf.addSheet('table2');
    const sheet2Id = 1;
    
    // Set some data in sheet2
    this.hf.setCellContents({ sheet: sheet2Id, row: 0, col: 0 }, 100);
    this.hf.setCellContents({ sheet: sheet2Id, row: 0, col: 1 }, 200);
    
    const testCases = [
      {
        formula: '=table2.A1',
        description: 'Reference to another sheet cell'
      },
      {
        formula: '=SUM(table2.A1:B1)',
        description: 'Reference to another sheet range'
      }
    ];

    testCases.forEach((testCase, index) => {
      try {
        const testCell = `I${index + 1}`;
        this.hf.setCellContents({ sheet: this.sheetId, row: index, col: 8 }, testCase.formula);
        const result = this.hf.getCellValue({ sheet: this.sheetId, row: index, col: 8 });
        
        console.log(`${testCase.description}:`);
        console.log(`  Formula: ${testCase.formula}`);
        console.log(`  Result: ${JSON.stringify(result)}`);
        console.log('');
      } catch (error) {
        console.log(`❌ ${testCase.description} failed: ${error}`);
      }
    });
  }

  cleanup() {
    this.hf.destroy();
  }

  async runAllTests() {
    console.log('🔍 Testing VLOOKUP, INDEX, MATCH Functions in HyperFormula...\n');
    
    try {
      this.setupTestData();
      this.testVLOOKUP();
      this.testINDEX();
      this.testMATCH();
      this.testINDEXMATCH();
      this.testCrossTableReferences();
      
      console.log('\n✅ Lookup function tests completed!');
      console.log('Check the results above to see which functions are natively supported.');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
    } finally {
      this.cleanup();
    }
  }
}

// Run tests
const testSuite = new LookupFunctionTest();
testSuite.runAllTests().catch(console.error);