import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: '.env.local' });

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.log('📝 Please create a .env.local file with your database connection string');
    console.log('📋 You can copy from .env.local.example and update the values');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    max: 1, // Use single connection for migrations
  });

  const db = drizzle(pool);

  try {
    console.log('🚀 Running database migrations...');
    
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), 'drizzle'),
    });

    console.log('✅ Database migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

export { runMigrations };