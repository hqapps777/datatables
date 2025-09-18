import { HyperFormula, ConfigParams } from 'hyperformula';

/**
 * Test to understand HyperFormula's native cross-sheet reference syntax
 */
class HyperFormulaCrossSheetTest {
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

  async testNativeCrossSheetSyntax() {
    console.log('\n=== Testing HyperFormula Native Cross-Sheet Syntax ===');
    
    try {
      // Create sheets
      this.hf.addSheet('Sheet1');
      this.hf.addSheet('Sheet2');
      
      const sheet1Id = this.hf.getSheetId('Sheet1');
      const sheet2Id = this.hf.getSheetId('Sheet2');
      
      if (sheet1Id === undefined || sheet2Id === undefined) {
        throw new Error('Failed to create sheets');
      }
      
      console.log(`Sheet1 ID: ${sheet1Id}`);
      console.log(`Sheet2 ID: ${sheet2Id}`);
      
      // Add data to Sheet1
      this.hf.setCellContents({ sheet: sheet1Id, row: 0, col: 0 }, 100);
      this.hf.setCellContents({ sheet: sheet1Id, row: 0, col: 1 }, 200);
      this.hf.setCellContents({ sheet: sheet1Id, row: 1, col: 0 }, 'Test');
      
      console.log('Sheet1 data: A1=100, B1=200, A2=Test');
      
      // Try different cross-sheet reference syntaxes
      const syntaxTests = [
        { syntax: '=Sheet1.A1', description: 'Sheet1.A1 syntax' },
        { syntax: '=Sheet1!A1', description: 'Sheet1!A1 syntax' },
        { syntax: '=#Sheet1.A1', description: '#Sheet1.A1 syntax' },
        { syntax: '=Sheet1.$A$1', description: 'Sheet1.$A$1 syntax' },
        { syntax: '=SUM(Sheet1.A1:B1)', description: 'Range with Sheet1.A1:B1' },
        { syntax: '=SUM(Sheet1!A1:B1)', description: 'Range with Sheet1!A1:B1' }
      ];
      
      syntaxTests.forEach((test, index) => {
        try {
          console.log(`\nTesting: ${test.description}`);
          console.log(`Formula: ${test.syntax}`);
          
          // Set formula in Sheet2
          this.hf.setCellContents({ sheet: sheet2Id, row: index, col: 0 }, test.syntax);
          const result = this.hf.getCellValue({ sheet: sheet2Id, row: index, col: 0 });
          
          console.log(`Result: ${JSON.stringify(result)}`);
          
          if (typeof result === 'object' && result && 'error' in result) {
            console.log('❌ Failed');
          } else {
            console.log('✅ Success');
          }
        } catch (error) {
          console.log(`❌ Exception: ${error}`);
        }
      });
      
    } catch (error) {
      console.error('Native cross-sheet syntax test failed:', error);
    }
  }

  async testAlternativeApproach() {
    console.log('\n=== Testing Alternative Approach ===');
    
    try {
      // Clear and recreate
      this.hf.destroy();
      
      const config: Partial<ConfigParams> = {
        licenseKey: 'gpl-v3',
        useColumnIndex: true,
        functionArgSeparator: ',',
        smartRounding: true,
      };
      this.hf = HyperFormula.buildEmpty(config);
      
      // Build sheets and add data
      this.hf.addSheet('Table1');
      this.hf.addSheet('Table2');
      
      const sheet1Id = this.hf.getSheetId('Table1');
      const sheet2Id = this.hf.getSheetId('Table2');
      
      if (sheet1Id !== undefined && sheet2Id !== undefined) {
        // Add data to Table1
        const sheet1Data = [
          [100, 200, 'Header'],
          ['Apple', 1.50, 'Fruit'],
          ['Banana', 0.80, 'Fruit']
        ];
        this.hf.setSheetContent(sheet1Id, sheet1Data);
        
        // Add data to Table2
        const sheet2Data = [
          [300, 400],
          ['Test', 'Value']
        ];
        this.hf.setSheetContent(sheet2Id, sheet2Data);
      }
      
      console.log('Created sheets with data using addSheet with data parameter');
      
      if (sheet1Id !== undefined && sheet2Id !== undefined) {
        // Try cross-references again
        const crossRefTests = [
          '=Table1.A1',
          '=Table1!A1', 
          "='Table1'.A1",
          '=INDIRECT("Table1.A1")',
          '=VLOOKUP("Apple", Table1.A1:C3, 2, 0)'
        ];
        
        crossRefTests.forEach((formula, index) => {
          try {
            console.log(`\nTesting: ${formula}`);
            this.hf.setCellContents({ sheet: sheet2Id, row: index + 2, col: 0 }, formula);
            const result = this.hf.getCellValue({ sheet: sheet2Id, row: index + 2, col: 0 });
            console.log(`Result: ${JSON.stringify(result)}`);
          } catch (error) {
            console.log(`❌ Exception: ${error}`);
          }
        });
      }
      
    } catch (error) {
      console.error('Alternative approach test failed:', error);
    }
  }

  cleanup() {
    this.hf.destroy();
  }

  async runAllTests() {
    console.log('🧪 Testing HyperFormula Cross-Sheet Reference Syntax...\n');
    
    try {
      await this.testNativeCrossSheetSyntax();
      await this.testAlternativeApproach();
      
      console.log('\n✅ Cross-sheet syntax tests completed!');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
    } finally {
      this.cleanup();
    }
  }
}

// Run tests
const testSuite = new HyperFormulaCrossSheetTest();
testSuite.runAllTests().catch(console.error);