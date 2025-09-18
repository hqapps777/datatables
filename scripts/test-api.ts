import { spawn } from 'child_process';

// Test configuration
const BASE_URL = 'http://localhost:3000';

// Test data
const TEST_TABLE_ID = 1; // Assuming table with ID 1 exists
const TEST_USER_ID = 1;

interface ApiResponse {
  data?: any;
  error?: string;
  message?: string;
  metadata?: any;
}

class ApiTester {
  private async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        // Add a test JWT token here if needed
        ...options.headers,
      },
    });

    return response;
  }

  async testColumnsAPI() {
    console.log('\n=== Testing Columns API ===');

    try {
      // Test GET /api/tables/:id/columns
      console.log('\n1. Testing GET /api/tables/:id/columns');
      let response = await this.request(`/api/tables/${TEST_TABLE_ID}/columns`);
      let result: ApiResponse = await response.json();
      console.log('Response:', response.status, result);

      // Test POST /api/tables/:id/columns
      console.log('\n2. Testing POST /api/tables/:id/columns');
      const newColumn = {
        name: 'test_column',
        type: 'text',
        config: { required: false },
      };
      response = await this.request(`/api/tables/${TEST_TABLE_ID}/columns`, {
        method: 'POST',
        body: JSON.stringify(newColumn),
      });
      result = await response.json();
      console.log('Response:', response.status, result);

      if (response.ok && result.data) {
        const columnId = result.data.id;

        // Test PATCH /api/columns/:id
        console.log(`\n3. Testing PATCH /api/columns/${columnId}`);
        const updateColumn = {
          name: 'updated_test_column',
          config: { required: true },
        };
        response = await this.request(`/api/columns/${columnId}`, {
          method: 'PATCH',
          body: JSON.stringify(updateColumn),
        });
        result = await response.json();
        console.log('Response:', response.status, result);

        // Test DELETE /api/columns/:id
        console.log(`\n4. Testing DELETE /api/columns/${columnId}`);
        response = await this.request(`/api/columns/${columnId}`, {
          method: 'DELETE',
        });
        result = await response.json();
        console.log('Response:', response.status, result);
      }
    } catch (error) {
      console.error('Columns API test failed:', error);
    }
  }

  async testRowsAPI() {
    console.log('\n=== Testing Rows API ===');

    try {
      // Test GET /api/tables/:id/rows (with pagination and sorting)
      console.log('\n1. Testing GET /api/tables/:id/rows with pagination');
      let response = await this.request(`/api/tables/${TEST_TABLE_ID}/rows?page=1&pageSize=5&sort=createdAt`);
      let result: ApiResponse = await response.json();
      console.log('Response:', response.status, result);

      // Test GET with filtering
      console.log('\n2. Testing GET /api/tables/:id/rows with filtering');
      response = await this.request(`/api/tables/${TEST_TABLE_ID}/rows?filter[id]=>=:1&page=1&pageSize=10`);
      result = await response.json();
      console.log('Response:', response.status, result);

      // Test POST /api/tables/:id/rows (single row)
      console.log('\n3. Testing POST /api/tables/:id/rows (single row)');
      const newRow = {
        data: {
          name: 'Test Row',
          description: 'This is a test row',
        }
      };
      response = await this.request(`/api/tables/${TEST_TABLE_ID}/rows`, {
        method: 'POST',
        body: JSON.stringify(newRow),
      });
      result = await response.json();
      console.log('Response:', response.status, result);

      if (response.ok && result.data) {
        const rowId = result.data.id;

        // Test PATCH /api/rows/:id
        console.log(`\n4. Testing PATCH /api/rows/${rowId}`);
        const updateRow = {
          data: {
            name: 'Updated Test Row',
            description: 'This row has been updated',
          }
        };
        response = await this.request(`/api/rows/${rowId}`, {
          method: 'PATCH',
          body: JSON.stringify(updateRow),
        });
        result = await response.json();
        console.log('Response:', response.status, result);

        // Test DELETE /api/rows/:id
        console.log(`\n5. Testing DELETE /api/rows/${rowId}`);
        response = await this.request(`/api/rows/${rowId}`, {
          method: 'DELETE',
        });
        result = await response.json();
        console.log('Response:', response.status, result);
      }

      // Test POST /api/tables/:id/rows (bulk creation)
      console.log('\n6. Testing POST /api/tables/:id/rows (bulk creation)');
      const bulkRows = {
        rows: [
          { data: { name: 'Bulk Row 1', description: 'First bulk row' } },
          { data: { name: 'Bulk Row 2', description: 'Second bulk row' } },
          { data: { name: 'Bulk Row 3', description: 'Third bulk row' } },
        ]
      };
      response = await this.request(`/api/tables/${TEST_TABLE_ID}/rows`, {
        method: 'POST',
        body: JSON.stringify(bulkRows),
      });
      result = await response.json();
      console.log('Response:', response.status, result);

    } catch (error) {
      console.error('Rows API test failed:', error);
    }
  }

  async testValidation() {
    console.log('\n=== Testing Validation ===');

    try {
      // Test invalid column type
      console.log('\n1. Testing invalid column type');
      const invalidColumn = {
        name: 'invalid_column',
        type: 'invalid_type',
      };
      let response = await this.request(`/api/tables/${TEST_TABLE_ID}/columns`, {
        method: 'POST',
        body: JSON.stringify(invalidColumn),
      });
      let result = await response.json();
      console.log('Response:', response.status, result);

      // Test missing required fields
      console.log('\n2. Testing missing required fields');
      const incompleteColumn = {
        name: 'incomplete_column',
        // missing type
      };
      response = await this.request(`/api/tables/${TEST_TABLE_ID}/columns`, {
        method: 'POST',
        body: JSON.stringify(incompleteColumn),
      });
      result = await response.json();
      console.log('Response:', response.status, result);

      // Test invalid row data
      console.log('\n3. Testing invalid row data');
      const invalidRow = {
        data: null, // should be an object
      };
      response = await this.request(`/api/tables/${TEST_TABLE_ID}/rows`, {
        method: 'POST',
        body: JSON.stringify(invalidRow),
      });
      result = await response.json();
      console.log('Response:', response.status, result);

    } catch (error) {
      console.error('Validation test failed:', error);
    }
  }

  async runAllTests() {
    console.log('Starting API Tests...');
    console.log(`Testing against: ${BASE_URL}`);
    console.log(`Using table ID: ${TEST_TABLE_ID}`);

    // Check if server is running
    try {
      const response = await this.request('/api/tables');
      if (!response.ok && response.status === 404) {
        console.log('API server is running');
      }
    } catch (error) {
      console.error('❌ Cannot connect to API server. Make sure the development server is running with: npm run dev');
      return;
    }

    await this.testColumnsAPI();
    await this.testRowsAPI(); 
    await this.testValidation();

    console.log('\n✅ All tests completed!');
    console.log('\nNote: Some tests may fail if the test table doesn\'t exist or authentication is required.');
    console.log('Check the responses above to see if the APIs are working correctly.');
  }
}

// Run tests
const tester = new ApiTester();
tester.runAllTests().catch(console.error);