import { CrossTableFormulaEngine } from '../src/lib/formula/cross-table-engine';
import { HyperFormula, ConfigParams } from 'hyperformula';

/**
 * Test cross-table reference functionality
 */
class CrossTableReferenceTest {
  private hf: HyperFormula;

  constructor() {
    const config: Partial<ConfigParams> = {
      licenseKey: 'gpl-v3',
      useColumnIndex: true,
      functionArgSeparator: ',',
      smartRounding: true,
    };

    this.hf = HyperFormula.buildEmpty(config);
  }

  async testBasicCrossSheetReferences() {
    console.log('\n=== Testing Basic Cross-Sheet References ===');
    
    try {
      // Create two sheets
      this.hf.addSheet('Table1');
      this.hf.addSheet('Table2');
      
      const sheet1Id = this.hf.getSheetId('Table1');
      const sheet2Id = this.hf.getSheetId('Table2');
      
      if (sheet1Id === undefined || sheet2Id === undefined) {
        throw new Error('Failed to create sheets');
      }
      
      // Add data to Table1
      this.hf.setCellContents({ sheet: sheet1Id, row: 0, col: 0 }, 'Product');
      this.hf.setCellContents({ sheet: sheet1Id, row: 0, col: 1 }, 'Price');
      this.hf.setCellContents({ sheet: sheet1Id, row: 1, col: 0 }, 'Apple');
      this.hf.setCellContents({ sheet: sheet1Id, row: 1, col: 1 }, 1.50);
      this.hf.setCellContents({ sheet: sheet1Id, row: 2, col: 0 }, 'Banana');
      this.hf.setCellContents({ sheet: sheet1Id, row: 2, col: 1 }, 0.80);
      
      // Add data to Table2
      this.hf.setCellContents({ sheet: sheet2Id, row: 0, col: 0 }, 'Item');
      this.hf.setCellContents({ sheet: sheet2Id, row: 0, col: 1 }, 'Quantity');
      this.hf.setCellContents({ sheet: sheet2Id, row: 1, col: 0 }, 'Apple');
      this.hf.setCellContents({ sheet: sheet2Id, row: 1, col: 1 }, 10);
      
      console.log('Table1 data set up');
      console.log('Table2 data set up');
      
      // Test cross-sheet references
      const testCases = [
        {
          formula: '=Table1.A2',
          description: 'Simple cross-sheet cell reference',
          expected: 'Apple'
        },
        {
          formula: '=Table1.B2',
          description: 'Cross-sheet numeric reference',
          expected: 1.50
        },
        {
          formula: '=SUM(Table1.B2:B3)',
          description: 'Cross-sheet range sum',
          expected: 2.30
        },
        {
          formula: '=VLOOKUP(Table2.A2, Table1.A1:B3, 2, 0)',
          description: 'VLOOKUP with cross-sheet references',
          expected: 1.50
        },
        {
          formula: '=INDEX(Table1.B1:B3, MATCH(Table2.A2, Table1.A1:A3, 0))',
          description: 'INDEX+MATCH with cross-sheet references',
          expected: 1.50
        }
      ];
      
      testCases.forEach((testCase, index) => {
        try {
          // Set formula in Table2
          this.hf.setCellContents({ sheet: sheet2Id, row: index + 2, col: 2 }, testCase.formula);
          const result = this.hf.getCellValue({ sheet: sheet2Id, row: index + 2, col: 2 });
          
          console.log(`${testCase.description}:`);
          console.log(`  Formula: ${testCase.formula}`);
          console.log(`  Result: ${JSON.stringify(result)}`);
          console.log(`  Expected: ${testCase.expected}`);
          
          if (result === testCase.expected) {
            console.log('  ✅ PASS');
          } else if (Math.abs(Number(result) - Number(testCase.expected)) < 0.001) {
            console.log('  ✅ PASS (numeric approximation)');
          } else {
            console.log('  ❌ FAIL');
          }
          console.log('');
        } catch (error) {
          console.log(`❌ ${testCase.description} failed: ${error}`);
        }
      });
      
    } catch (error) {
      console.error('Basic cross-sheet reference test failed:', error);
    }
  }

  testCrossTableReferencePatterns() {
    console.log('\n=== Testing Cross-Table Reference Patterns ===');
    
    const testPatterns = [
      'Table1!A1',
      'Table1!A1:B10',
      '[Table Name]!A1',
      '[Complex Table Name]!A1:C5',
      'SimpleTable!B2:D4',
    ];
    
    // Test regex pattern matching
    const crossTableRegex = /(\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))!([A-Z$]+\d+(?::[A-Z$]+\d+)?)/g;
    
    testPatterns.forEach(pattern => {
      const matches = [...pattern.matchAll(crossTableRegex)];
      console.log(`Pattern: ${pattern}`);
      
      if (matches.length > 0) {
        const match = matches[0];
        const bracketedTableName = match[2];
        const simpleTableName = match[3];
        const cellRange = match[4];
        const tableName = bracketedTableName || simpleTableName;
        
        console.log(`  ✅ Parsed: Table="${tableName}", Range="${cellRange}"`);
      } else {
        console.log('  ❌ No match found');
      }
      console.log('');
    });
  }

  cleanup() {
    this.hf.destroy();
  }

  async runAllTests() {
    console.log('🔗 Testing Cross-Table Reference Functionality...\n');
    
    try {
      await this.testBasicCrossSheetReferences();
      this.testCrossTableReferencePatterns();
      
      console.log('\n✅ Cross-table reference tests completed!');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
    } finally {
      this.cleanup();
    }
  }
}

// Run tests
const testSuite = new CrossTableReferenceTest();
testSuite.runAllTests().catch(console.error);