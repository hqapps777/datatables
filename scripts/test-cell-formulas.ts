#!/usr/bin/env tsx

/**
 * Test Cell-Level Formula Operations
 * Tests the new PATCH /api/cells/:id endpoint with formula support
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const API_BASE = 'http://localhost:3000/api';
const TEST_TOKEN = process.env.TEST_JWT_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NTgxMjU4NjYsImV4cCI6MTc1ODIxMjI2Nn0.OfY7YC8LJIx_uTTjQ-9mIBN4R1poqwlD3mzsbj-SA-A';

console.log('🔑 Using token:', TEST_TOKEN.substring(0, 50) + '...');

interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
}

interface Cell {
  id: number;
  value: any;
  formula?: string | null;
  error?: string | null;
  calcVersion?: number;
  updatedCells?: Array<{ id: number; value: any; error?: string | null }>;
}

async function apiRequest(
  method: string,
  endpoint: string,
  body?: any,
  token?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function testCellFormulas() {
  console.log('🧪 Testing Cell-Level Formula Operations\n');

  try {
    // Test 1: Set a simple value
    console.log('1️⃣ Testing simple value update...');
    let response = await apiRequest('PATCH', '/cells/1', {
      value_json: '42'
    }, TEST_TOKEN);

    if (!response.ok) {
      console.error('❌ Simple value update failed:', await response.text());
      return;
    }

    let result: ApiResponse<Cell> = await response.json();
    console.log('✅ Simple value update successful:', result.data);
    console.log();

    // Test 2: Set a basic formula
    console.log('2️⃣ Testing basic formula...');
    response = await apiRequest('PATCH', '/cells/2', {
      formula: '=A1*2'
    }, TEST_TOKEN);

    if (!response.ok) {
      console.error('❌ Basic formula failed:', await response.text());
      return;
    }

    result = await response.json();
    console.log('✅ Basic formula successful:', result.data);
    if (result.data?.updatedCells?.length) {
      console.log('   📊 Updated cells:', result.data.updatedCells);
    }
    console.log();

    // Test 3: Set a SUM formula
    console.log('3️⃣ Testing SUM formula...');
    response = await apiRequest('PATCH', '/cells/3', {
      formula: '=SUM(A1:A2)'
    }, TEST_TOKEN);

    if (!response.ok) {
      console.error('❌ SUM formula failed:', await response.text());
      return;
    }

    result = await response.json();
    console.log('✅ SUM formula successful:', result.data);
    if (result.data?.updatedCells?.length) {
      console.log('   📊 Updated cells:', result.data.updatedCells);
    }
    console.log();

    // Test 4: Create a dependency chain
    console.log('4️⃣ Testing dependency chain (A4 = A3 + 10)...');
    response = await apiRequest('PATCH', '/cells/4', {
      formula: '=A3+10'
    }, TEST_TOKEN);

    if (!response.ok) {
      console.error('❌ Dependency chain failed:', await response.text());
      return;
    }

    result = await response.json();
    console.log('✅ Dependency chain successful:', result.data);
    if (result.data?.updatedCells?.length) {
      console.log('   📊 Updated cells:', result.data.updatedCells);
    }
    console.log();

    // Test 5: Test division by zero error
    console.log('5️⃣ Testing #DIV/0! error...');
    response = await apiRequest('PATCH', '/cells/5', {
      formula: '=10/0'
    }, TEST_TOKEN);

    if (!response.ok) {
      console.error('❌ Division by zero test failed:', await response.text());
      return;
    }

    result = await response.json();
    console.log('✅ Division by zero handled:', result.data);
    console.log('   🔍 Expected error code: #DIV/0!');
    console.log();

    // Test 6: Test invalid reference error
    console.log('6️⃣ Testing #REF! error...');
    response = await apiRequest('PATCH', '/cells/6', {
      formula: '=ZZ999'
    }, TEST_TOKEN);

    if (!response.ok) {
      console.error('❌ Invalid reference test failed:', await response.text());
      return;
    }

    result = await response.json();
    console.log('✅ Invalid reference handled:', result.data);
    console.log('   🔍 Expected error code: #REF! or similar');
    console.log();

    // Test 7: Update a cell that others depend on
    console.log('7️⃣ Testing recalculation cascade (update A1)...');
    response = await apiRequest('PATCH', '/cells/1', {
      value_json: '100'
    }, TEST_TOKEN);

    if (!response.ok) {
      console.error('❌ Recalculation cascade failed:', await response.text());
      return;
    }

    result = await response.json();
    console.log('✅ Recalculation cascade successful:', result.data);
    if (result.data?.updatedCells?.length) {
      console.log('   📊 Recalculated cells:', result.data.updatedCells);
      console.log('   🔍 Should see multiple cells updated due to dependencies');
    }
    console.log();

    // Test 8: Clear a formula (set to null)
    console.log('8️⃣ Testing formula clearing...');
    response = await apiRequest('PATCH', '/cells/2', {
      value_json: '999',
      formula: null
    }, TEST_TOKEN);

    if (!response.ok) {
      console.error('❌ Formula clearing failed:', await response.text());
      return;
    }

    result = await response.json();
    console.log('✅ Formula clearing successful:', result.data);
    if (result.data?.updatedCells?.length) {
      console.log('   📊 Updated cells:', result.data.updatedCells);
    }
    console.log();

    console.log('🎉 All cell formula tests completed successfully!');

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Helper function to set up test data
async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  // Ensure we have at least a few cells to work with
  // This assumes we have a test table with ID 1 and some rows/columns
  try {
    // Create some basic cells if they don't exist
    const cells = [
      { tableId: 1, rowId: 1, columnId: 1 }, // A1
      { tableId: 1, rowId: 2, columnId: 1 }, // A2
      { tableId: 1, rowId: 3, columnId: 1 }, // A3
      { tableId: 1, rowId: 4, columnId: 1 }, // A4
      { tableId: 1, rowId: 5, columnId: 1 }, // A5
      { tableId: 1, rowId: 6, columnId: 1 }, // A6
    ];

    for (let i = 0; i < cells.length; i++) {
      const response = await apiRequest('PATCH', `/cells/${i + 1}`, {
        value_json: '0'
      }, TEST_TOKEN);
      
      if (!response.ok && response.status !== 404) {
        console.warn(`⚠️ Could not initialize cell ${i + 1}:`, await response.text());
      }
    }
    
    console.log('✅ Test data setup completed\n');
  } catch (error) {
    console.warn('⚠️ Test data setup had issues:', error);
  }
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      await setupTestData();
      await testCellFormulas();
    } catch (error) {
      console.error('💥 Script failed:', error);
      process.exit(1);
    }
  })();
}

export { testCellFormulas, setupTestData };