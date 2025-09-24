#!/usr/bin/env tsx

/**
 * Performance Test Script für Chunked Bulk-Update
 * Testet die neue vs. alte Implementierung
 */

import { performance } from 'perf_hooks';

interface PerformanceResult {
  strategy: string;
  totalCells: number;
  apiCalls: number;
  timeMs: number;
  cellsPerSecond: number;
}

class BulkPastePerformanceTest {
  
  /**
   * Simuliert die alte N+1 API-Call Implementierung
   */
  static async simulateOldPasteMethod(data: string[][]): Promise<PerformanceResult> {
    const startTime = performance.now();
    
    let totalCells = 0;
    let apiCalls = 0;
    
    // Simulate individual API calls for each cell
    for (const row of data) {
      for (const cell of row) {
        if (cell && cell.trim() !== '') {
          // Simulate API call delay (50-100ms per call)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 50));
          totalCells++;
          apiCalls++;
        }
      }
    }
    
    const endTime = performance.now();
    const timeMs = endTime - startTime;
    
    return {
      strategy: 'Old N+1 Method',
      totalCells,
      apiCalls,
      timeMs,
      cellsPerSecond: Math.round((totalCells / timeMs) * 1000)
    };
  }
  
  /**
   * Simuliert die neue Chunked Bulk-Update Implementierung
   */
  static async simulateNewChunkedMethod(data: string[][]): Promise<PerformanceResult> {
    const startTime = performance.now();
    
    const totalCells = data.flat().filter(cell => cell && cell.trim() !== '').length;
    
    // Determine chunk strategy based on data size
    const CHUNK_STRATEGY = {
      small: { size: 50, parallel: 2, threshold: 200 },
      medium: { size: 100, parallel: 3, threshold: 1000 },
      large: { size: 200, parallel: 4, threshold: 5000 },
      huge: { size: 500, parallel: 2, threshold: Infinity }
    };
    
    const strategy = totalCells <= CHUNK_STRATEGY.small.threshold ? CHUNK_STRATEGY.small :
                    totalCells <= CHUNK_STRATEGY.medium.threshold ? CHUNK_STRATEGY.medium :
                    totalCells <= CHUNK_STRATEGY.large.threshold ? CHUNK_STRATEGY.large :
                    CHUNK_STRATEGY.huge;
    
    // Create chunks
    const chunks: string[][] = [];
    let currentChunk: string[] = [];
    
    for (const row of data) {
      for (const cell of row) {
        if (cell && cell.trim() !== '') {
          currentChunk.push(cell);
          
          if (currentChunk.length >= strategy.size) {
            chunks.push([...currentChunk]);
            currentChunk = [];
          }
        }
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    // Process chunks in parallel batches
    let apiCalls = 0;
    
    for (let i = 0; i < chunks.length; i += strategy.parallel) {
      const batch = chunks.slice(i, i + strategy.parallel);
      
      const batchPromises = batch.map(async (chunk) => {
        // Simulate bulk API call (200-300ms per chunk regardless of size)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 200));
        apiCalls++;
        return chunk.length;
      });
      
      await Promise.all(batchPromises);
    }
    
    const endTime = performance.now();
    const timeMs = endTime - startTime;
    
    return {
      strategy: 'New Chunked Method',
      totalCells,
      apiCalls,
      timeMs,
      cellsPerSecond: Math.round((totalCells / timeMs) * 1000)
    };
  }
  
  /**
   * Generiert Test-Daten verschiedener Größen
   */
  static generateTestData(rows: number, cols: number): string[][] {
    const data: string[][] = [];
    
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(`Cell_${r + 1}_${c + 1}`);
      }
      data.push(row);
    }
    
    return data;
  }
  
  /**
   * Führt Performance-Vergleich durch
   */
  static async runPerformanceComparison() {
    console.log('🚀 Chunked Bulk-Update Performance Test\n');
    
    const testCases = [
      { name: 'Small (10x10)', rows: 10, cols: 10 },
      { name: 'Medium (20x20)', rows: 20, cols: 20 },
      { name: 'Large (30x30)', rows: 30, cols: 30 },
      { name: 'Very Large (50x20)', rows: 50, cols: 20 }
    ];
    
    for (const testCase of testCases) {
      console.log(`📊 Testing ${testCase.name} = ${testCase.rows * testCase.cols} cells`);
      console.log('─'.repeat(60));
      
      const testData = this.generateTestData(testCase.rows, testCase.cols);
      
      // Test old method (nur für kleine Datensätze wegen der langen Laufzeit)
      let oldResult: PerformanceResult | null = null;
      if (testCase.rows * testCase.cols <= 100) {
        console.log('⏱️  Testing old N+1 method...');
        oldResult = await this.simulateOldPasteMethod(testData);
      }
      
      // Test new method
      console.log('⚡ Testing new chunked method...');
      const newResult = await this.simulateNewChunkedMethod(testData);
      
      // Display results
      if (oldResult) {
        console.log(`\n📈 Results for ${testCase.name}:`);
        console.log(`Old Method: ${oldResult.timeMs.toFixed(0)}ms, ${oldResult.apiCalls} API calls, ${oldResult.cellsPerSecond} cells/sec`);
        console.log(`New Method: ${newResult.timeMs.toFixed(0)}ms, ${newResult.apiCalls} API calls, ${newResult.cellsPerSecond} cells/sec`);
        
        const speedup = oldResult.timeMs / newResult.timeMs;
        const apiReduction = ((oldResult.apiCalls - newResult.apiCalls) / oldResult.apiCalls) * 100;
        
        console.log(`\n✅ Improvement: ${speedup.toFixed(1)}x faster, ${apiReduction.toFixed(0)}% fewer API calls\n`);
      } else {
        console.log(`\n📈 Results for ${testCase.name}:`);
        console.log(`New Method: ${newResult.timeMs.toFixed(0)}ms, ${newResult.apiCalls} API calls, ${newResult.cellsPerSecond} cells/sec`);
        console.log(`Estimated Old Method: ~${(newResult.totalCells * 75).toFixed(0)}ms, ${newResult.totalCells} API calls`);
        
        const estimatedSpeedup = (newResult.totalCells * 75) / newResult.timeMs;
        const apiReduction = ((newResult.totalCells - newResult.apiCalls) / newResult.totalCells) * 100;
        
        console.log(`✅ Estimated Improvement: ~${estimatedSpeedup.toFixed(1)}x faster, ${apiReduction.toFixed(0)}% fewer API calls\n`);
      }
    }
  }
}

// Run the test if script is executed directly
if (require.main === module) {
  BulkPastePerformanceTest.runPerformanceComparison().catch(console.error);
}

export { BulkPastePerformanceTest };