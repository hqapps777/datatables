import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Database connection configuration
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres connection pool
const pool = new Pool({
  connectionString,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error if connection takes longer than 2 seconds
});

// Create drizzle database instance with schema
export const db = drizzle(pool, { schema });

// Export schema for type inference
export * from './schema';

// Types for better type safety
export type Database = typeof db;
export type Schema = typeof schema;

// Close database connection (useful for testing and cleanup)
export const closeDb = async () => {
  await pool.end();
};