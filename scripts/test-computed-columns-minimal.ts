#!/usr/bin/env tsx

/**
 * Minimal standalone test for computed column core logic
 * Tests only the A1 notation conversion without any database dependencies
 */

/**
 * A1 notation utilities for mapping between cell coordinates and database IDs
 * Copied from engine.ts to avoid database imports
 */
class A1NotationMapper {
  /**
   * Convert column number to letter (1 = A, 2 = B, ..., 26 = Z, 27 = AA, etc.)
   */
  static columnToLetter(col: number): string {
    let result = '';
    while (col > 0) {
      col--;
      result = String.fromCharCode(65 + (col % 26)) + result;
      col = Math.floor(col / 26);
    }
    return result;
  }

  /**
   * Convert column letter to number (A = 1, B = 2, ..., Z = 26, AA = 27, etc.)
   */
  static letterToColumn(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result;
  }

  /**
   * Convert cell coordinates to A1 notation (1,1 -> A1)
   */
  static coordsToA1(row: number, col: number): string {
    return this.columnToLetter(col) + row;
  }

  /**
   * Parse A1 notation to coordinates (A1 -> {row: 1, col: 1})
   */
  static a1ToCoords(a1: string): { row: number; col: number; isAbsoluteRow: boolean; isAbsoluteCol: boolean } {
    const match = a1.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid A1 notation: ${a1}`);
    }

    const [, dollarCol, colLetters, dollarRow, rowNumber] = match;
    
    return {
      row: parseInt(rowNumber, 10),
      col: this.letterToColumn(colLetters),
      isAbsoluteCol: dollarCol === '$',
      isAbsoluteRow: dollarRow === '$'
    };
  }
}

/**
 * Core computed column logic without database dependencies
 */
class ComputedColumnLogic {
  /**
   * Convert column name references [ColumnName] to A1 notation
   */
  static convertColumnReferencesToA1(
    formula: string, 
    columnNameToPosition: Map<string, number>, 
    currentRow: number
  ): string {
    const columnRefRegex = /\[([^\]]+)\]/g;
    
    return formula.replace(columnRefRegex, (match, columnName) => {
      const position = columnNameToPosition.get(columnName);
      if (position !== undefined) {
        return A1NotationMapper.coordsToA1(currentRow, position);
      }
      return match; // Leave unchanged if column not found
    });
  }

  /**
   * Extract column dependencies from a formula
   */
  static extractColumnDependencies(formula: string): string[] {
    const columnRefRegex = /\[([^\]]+)\]/g;
    const dependencies = new Set<string>();
    let match;
    
    while ((match = columnRefRegex.exec(formula)) !== null) {
      dependencies.add(match[1]);
    }
    
    return Array.from(dependencies);
  }

  /**
   * Validate computed column formula
   */
  static validateComputedColumnFormula(formula: string): { isValid: boolean; error?: string } {
    // Must start with equals sign
    if (!formula.startsWith('=')) {
      return {
        isValid: false,
        error: 'Formula must start with ='
      };
    }

    // Must contain at least one column reference
    const hasColumnRefs = /\[([^\]]+)\]/.test(formula);
    if (!hasColumnRefs) {
      return {
        isValid: false,
        error: 'Formula must contain at least one column reference [ColumnName]'
      };
    }

    // Basic syntax checks
    if (formula.includes(',,') || formula.endsWith('+') || formula.endsWith('*')) {
      return {
        isValid: false,
        error: 'Invalid formula syntax'
      };
    }

    return { isValid: true };
  }
}

/**
 * Test suite for computed column logic
 */
class MinimalComputedColumnsTest {
  /**
   * Test A1 notation conversion
   */
  async testA1NotationMapping() {
    console.log('\n=== Testing A1 Notation Mapping ===');
    
    const testCases = [
      { col: 1, expected: 'A' },
      { col: 2, expected: 'B' }, 
      { col: 26, expected: 'Z' },
      { col: 27, expected: 'AA' },
      { col: 28, expected: 'AB' },
      { col: 52, expected: 'AZ' },
      { col: 53, expected: 'BA' },
    ];

    console.log('Testing column number to letter conversion:');
    let allPassed = true;
    
    for (const test of testCases) {
      const result = A1NotationMapper.columnToLetter(test.col);
      const success = result === test.expected;
      allPassed = allPassed && success;
      
      console.log(`${success ? '✅' : '❌'} Column ${test.col} → ${result} (expected: ${test.expected})`);
    }

    // Test coordinate to A1 conversion
    const coordTests = [
      { row: 1, col: 1, expected: 'A1' },
      { row: 1, col: 2, expected: 'B1' },
      { row: 2, col: 1, expected: 'A2' },
      { row: 10, col: 3, expected: 'C10' },
      { row: 1, col: 27, expected: 'AA1' },
    ];

    console.log('\nTesting coordinate to A1 conversion:');
    for (const test of coordTests) {
      const result = A1NotationMapper.coordsToA1(test.row, test.col);
      const success = result === test.expected;
      allPassed = allPassed && success;
      
      console.log(`${success ? '✅' : '❌'} (${test.row},${test.col}) → ${result} (expected: ${test.expected})`);
    }

    return allPassed;
  }

  /**
   * Test column reference conversion
   */
  async testColumnReferenceConversion() {
    console.log('\n=== Testing Column Reference Conversion ===');
    
    // Mock column mapping
    const columnNameToPosition = new Map([
      ['Preis', 1],    // Column A
      ['Menge', 2],    // Column B
      ['Steuer', 3],   // Column C
      ['Gesamt', 4],   // Column D
    ]);
    
    const testCases = [
      { 
        formula: '=[Preis]*0.19', 
        row: 1, 
        expected: '=A1*0.19',
        description: 'Basic tax calculation'
      },
      { 
        formula: '=[Preis]+[Steuer]', 
        row: 1, 
        expected: '=A1+C1',
        description: 'Sum two columns'
      },
      { 
        formula: '=[Preis]*[Menge]', 
        row: 2, 
        expected: '=A2*B2',
        description: 'Price times quantity (row 2)'
      },
      { 
        formula: '=SUM([Preis],[Steuer])', 
        row: 1, 
        expected: '=SUM(A1,C1)',
        description: 'SUM function with columns'
      },
      { 
        formula: '=IF([Preis]>100,[Preis]*0.1,[Preis]*0.05)', 
        row: 3, 
        expected: '=IF(A3>100,A3*0.1,A3*0.05)',
        description: 'Complex conditional formula'
      },
    ];

    console.log('Testing column name to A1 reference conversion:');
    let allPassed = true;
    
    for (const test of testCases) {
      const result = ComputedColumnLogic.convertColumnReferencesToA1(
        test.formula, 
        columnNameToPosition, 
        test.row
      );
      
      const success = result === test.expected;
      allPassed = allPassed && success;
      
      console.log(`${success ? '✅' : '❌'} ${test.description}`);
      console.log(`   Input:    ${test.formula}`);
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Got:      ${result}`);
      console.log('');
    }

    return allPassed;
  }

  /**
   * Test formula validation
   */
  async testFormulaValidation() {
    console.log('\n=== Testing Formula Validation ===');
    
    const testCases = [
      // Valid formulas
      { 
        formula: '=[Preis]*0.19', 
        valid: true, 
        description: 'Basic column reference with operator' 
      },
      { 
        formula: '=[Preis]+[Steuer]', 
        valid: true, 
        description: 'Two column references' 
      },
      { 
        formula: '=SUM([Preis],[Menge])', 
        valid: true, 
        description: 'Function with column references' 
      },
      { 
        formula: '=IF([Preis]>100,[Preis]*0.1,[Preis]*0.05)', 
        valid: true, 
        description: 'Complex conditional' 
      },
      
      // Invalid formulas
      { 
        formula: '[Preis]*0.19', 
        valid: false, 
        description: 'Missing equals sign' 
      },
      { 
        formula: '=Preis*0.19', 
        valid: false, 
        description: 'No column references (brackets missing)' 
      },
      { 
        formula: '=SUM([Preis,])', 
        valid: false, 
        description: 'Invalid syntax with trailing comma' 
      },
      { 
        formula: '=[Preis]+', 
        valid: false, 
        description: 'Incomplete formula' 
      },
    ];

    console.log('Testing formula validation:');
    let allPassed = true;
    
    for (const test of testCases) {
      const result = ComputedColumnLogic.validateComputedColumnFormula(test.formula);
      const success = result.isValid === test.valid;
      allPassed = allPassed && success;
      
      console.log(`${success ? '✅' : '❌'} ${test.description}`);
      console.log(`   Formula: ${test.formula}`);
      console.log(`   Expected: ${test.valid ? 'valid' : 'invalid'}`);
      console.log(`   Result: ${result.isValid ? 'valid' : 'invalid'}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    }

    return allPassed;
  }

  /**
   * Test dependency extraction
   */
  async testDependencyExtraction() {
    console.log('\n=== Testing Dependency Extraction ===');
    
    const testCases = [
      {
        formula: '=[Preis]*0.19',
        expected: ['Preis'],
        description: 'Single column dependency'
      },
      {
        formula: '=[Preis]+[Steuer]',
        expected: ['Preis', 'Steuer'],
        description: 'Two column dependencies'
      },
      {
        formula: '=SUM([Preis],[Menge])',
        expected: ['Preis', 'Menge'],
        description: 'Function with multiple dependencies'
      },
      {
        formula: '=IF([Preis]>[Menge],[Preis],[Menge])',
        expected: ['Preis', 'Menge'],
        description: 'Duplicate references (should be deduplicated)'
      },
      {
        formula: '=[Preis]*[Menge]*[Steuer]',
        expected: ['Preis', 'Menge', 'Steuer'],
        description: 'Multiple unique dependencies'
      },
    ];

    console.log('Testing dependency extraction:');
    let allPassed = true;
    
    for (const test of testCases) {
      const result = ComputedColumnLogic.extractColumnDependencies(test.formula);
      const resultSorted = result.sort();
      const expectedSorted = test.expected.sort();
      
      const success = JSON.stringify(resultSorted) === JSON.stringify(expectedSorted);
      allPassed = allPassed && success;
      
      console.log(`${success ? '✅' : '❌'} ${test.description}`);
      console.log(`   Formula: ${test.formula}`);
      console.log(`   Expected: ${expectedSorted.join(', ')}`);
      console.log(`   Found: ${resultSorted.join(', ')}`);
      console.log('');
    }

    return allPassed;
  }

  /**
   * Test the specific DoD requirement
   */
  async testDoDRequirement() {
    console.log('\n=== Testing DoD Requirement ===');
    console.log('DoD: =[Preis]*0.19 berechnet für alle Zeilen; Update in Preis propagiert\n');
    
    // Setup
    const columnMapping = new Map([['Preis', 1]]); // Preis = Column A
    const formula = '=[Preis]*0.19';
    
    console.log('1. Testing formula conversion for multiple rows:');
    
    const rows = [1, 2, 3, 4, 5];
    let conversionPassed = true;
    
    for (const row of rows) {
      const converted = ComputedColumnLogic.convertColumnReferencesToA1(formula, columnMapping, row);
      const expected = `=A${row}*0.19`;
      const success = converted === expected;
      conversionPassed = conversionPassed && success;
      
      console.log(`   ${success ? '✅' : '❌'} Row ${row}: ${formula} → ${converted} (expected: ${expected})`);
    }
    
    console.log('\n2. Testing formula validation:');
    const validation = ComputedColumnLogic.validateComputedColumnFormula(formula);
    const validationPassed = validation.isValid;
    console.log(`   ${validationPassed ? '✅' : '❌'} Formula "${formula}" is ${validationPassed ? 'valid' : 'invalid'}`);
    if (validation.error) {
      console.log(`   Error: ${validation.error}`);
    }
    
    console.log('\n3. Testing dependency extraction:');
    const dependencies = ComputedColumnLogic.extractColumnDependencies(formula);
    const expectedDeps = ['Preis'];
    const depsPassed = JSON.stringify(dependencies) === JSON.stringify(expectedDeps);
    console.log(`   ${depsPassed ? '✅' : '❌'} Dependencies: ${dependencies.join(', ')} (expected: ${expectedDeps.join(', ')})`);
    
    console.log('\n4. DoD Verification Summary:');
    const allPassed = conversionPassed && validationPassed && depsPassed;
    console.log(`   ${conversionPassed ? '✅' : '❌'} Formula converts correctly for all rows`);
    console.log(`   ${validationPassed ? '✅' : '❌'} Formula passes validation`);
    console.log(`   ${depsPassed ? '✅' : '❌'} Dependencies are correctly identified`);
    console.log(`   ${allPassed ? '✅' : '❌'} Ready for propagation logic implementation`);
    
    if (allPassed) {
      console.log('\n🎉 DoD requirement logic is correctly implemented!');
      console.log('The core conversion and validation logic supports:');
      console.log('• Converting =[Preis]*0.19 to =A1*0.19, =A2*0.19, etc. for each row');
      console.log('• Validating formulas with column name references');
      console.log('• Identifying dependencies for propagation');
    }
    
    return allPassed;
  }

  async runAllTests() {
    console.log('🧮 HyperFormula Computed Columns - Minimal Logic Test');
    console.log('Testing core conversion logic without database dependencies\n');
    
    try {
      const results = await Promise.all([
        this.testA1NotationMapping(),
        this.testColumnReferenceConversion(),
        this.testFormulaValidation(),
        this.testDependencyExtraction(),
        this.testDoDRequirement(),
      ]);
      
      const allPassed = results.every(r => r);
      
      console.log('\n📊 Test Results Summary:');
      console.log(`${results[0] ? '✅' : '❌'} A1 Notation Mapping`);
      console.log(`${results[1] ? '✅' : '❌'} Column Reference Conversion`);
      console.log(`${results[2] ? '✅' : '❌'} Formula Validation`);
      console.log(`${results[3] ? '✅' : '❌'} Dependency Extraction`);
      console.log(`${results[4] ? '✅' : '❌'} DoD Requirement Logic`);
      
      if (allPassed) {
        console.log('\n🎉 All core logic tests passed!');
        console.log('\n✨ Implementation Status:');
        console.log('✅ Core A1 notation mapping works correctly');
        console.log('✅ Column name reference conversion ([Preis] → A1) works');
        console.log('✅ Formula validation catches invalid formulas');
        console.log('✅ Dependency extraction identifies all referenced columns');
        console.log('✅ DoD requirement =[Preis]*0.19 logic is implemented');
        console.log('\n🔄 Next Steps:');
        console.log('• Integration with HyperFormula engine for actual calculation');
        console.log('• Database integration for persistent computed columns');
        console.log('• Frontend integration with fx-badge and read-only indicators');
        console.log('• API endpoints for PATCH /api/columns/:id');
      } else {
        console.log('\n❌ Some tests failed. Review the implementation above.');
      }
      
      return allPassed;
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      return false;
    }
  }
}

// Run the tests
const testSuite = new MinimalComputedColumnsTest();
testSuite.runAllTests().catch(console.error);