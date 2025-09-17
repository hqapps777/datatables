import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env.local' });

export default {
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
