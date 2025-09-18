import { HyperFormula, ConfigParams } from 'hyperformula';

/**
 * Test VLOOKUP with corrected parameters (0/1 instead of TRUE/FALSE)
 */
class VLookupCorrectedTest {
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
    
    // Display the data
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      for (let col = 0; col < 3; col++) {
        const value = this.hf.getCellValue({ sheet: this.sheetId, row, col });
        rowData.push(value);
      }
      console.log(`Row ${row + 1}:`, rowData);
    }
  }

  testVLOOKUP() {
    console.log('\n=== Testing VLOOKUP Function (Corrected Parameters) ===');
    
    const testCases = [
      {
        formula: '=VLOOKUP("Apple", A1:C5, 2, 0)',
        description: 'VLOOKUP Apple price (exact match - 0)',
        expected: 1.50
      },
      {
        formula: '=VLOOKUP("Banana", A1:C5, 3, 0)', 
        description: 'VLOOKUP Banana category (exact match - 0)',
        expected: 'Fruit'
      },
      {
        formula: '=VLOOKUP("Apple", A1:C5, 2, 1)',
        description: 'VLOOKUP Apple price (approximate match - 1)',
        expected: 1.50
      },
      {
        formula: '=VLOOKUP("NotFound", A1:C5, 2, 0)',
        description: 'VLOOKUP non-existent item (should return #N/A)',
        expected: '#N/A'
      },
      {
        formula: '=VLOOKUP("Apple", A2:C5, 2, 0)',
        description: 'VLOOKUP without header row',
        expected: 1.50
      },
      {
        formula: '=VLOOKUP("Carrot", A1:C5, 1, 0)',
        description: 'VLOOKUP return column 1 (1-based indexing)',
        expected: 'Carrot'
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
        console.log(`  Expected: ${testCase.expected}`);
        
        if (result === testCase.expected) {
          console.log('  ✅ PASS');
        } else if (typeof result === 'object' && result && 'value' in result && result.value === testCase.expected) {
          console.log('  ✅ PASS');
        } else if (typeof result === 'object' && result && 'type' in result && result.type === 'NA' && testCase.expected === '#N/A') {
          console.log('  ✅ PASS (N/A error as expected)');
        } else {
          console.log('  ❌ FAIL');
        }
        console.log('');
      } catch (error) {
        console.log(`❌ ${testCase.description} failed: ${error}`);
      }
    });
  }

  testVLOOKUPvsINDEXMATCH() {
    console.log('\n=== Comparing VLOOKUP vs INDEX+MATCH Results ===');
    
    const testItems = ['Apple', 'Banana', 'Carrot', 'Broccoli'];
    
    testItems.forEach((item, index) => {
      try {
        // VLOOKUP for price (column 2)
        const vlookupFormula = `=VLOOKUP("${item}", A1:C5, 2, 0)`;
        this.hf.setCellContents({ sheet: this.sheetId, row: index, col: 5 }, vlookupFormula);
        const vlookupResult = this.hf.getCellValue({ sheet: this.sheetId, row: index, col: 5 });
        
        // INDEX+MATCH for price
        const indexMatchFormula = `=INDEX(B1:B5, MATCH("${item}", A1:A5, 0))`;
        this.hf.setCellContents({ sheet: this.sheetId, row: index, col: 6 }, indexMatchFormula);
        const indexMatchResult = this.hf.getCellValue({ sheet: this.sheetId, row: index, col: 6 });
        
        console.log(`${item}:`);
        console.log(`  VLOOKUP: ${JSON.stringify(vlookupResult)}`);
        console.log(`  INDEX+MATCH: ${JSON.stringify(indexMatchResult)}`);
        
        if (vlookupResult === indexMatchResult) {
          console.log('  ✅ Results match');
        } else {
          console.log('  ❌ Results differ');
        }
        console.log('');
        
      } catch (error) {
        console.log(`❌ Test for ${item} failed: ${error}`);
      }
    });
  }

  cleanup() {
    this.hf.destroy();
  }

  async runAllTests() {
    console.log('🔍 Testing VLOOKUP with Corrected Parameters...\n');
    
    try {
      this.setupTestData();
      this.testVLOOKUP();
      this.testVLOOKUPvsINDEXMATCH();
      
      console.log('\n✅ VLOOKUP corrected parameter tests completed!');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
    } finally {
      this.cleanup();
    }
  }
}

// Run tests
const testSuite = new VLookupCorrectedTest();
testSuite.runAllTests().catch(console.error);