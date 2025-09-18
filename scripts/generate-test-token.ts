#!/usr/bin/env tsx

/**
 * Generate Test JWT Token
 * Creates a JWT token for testing API endpoints
 */

import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

config({ path: '.env.local' });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function generateTestToken(userId: number = 1, email: string = 'admin@example.com') {
  const payload = {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };

  const token = jwt.sign(payload, JWT_SECRET);
  
  console.log('🔑 Generated Test JWT Token:');
  console.log(token);
  console.log('');
  console.log('📋 Copy this token to your .env.local file:');
  console.log(`TEST_JWT_TOKEN="${token}"`);
  console.log('');
  console.log('🔍 Token payload:');
  console.log(JSON.stringify(payload, null, 2));
  
  return token;
}

if (require.main === module) {
  generateTestToken();
}

export { generateTestToken };