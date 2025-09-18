# DataTables - Database Schema Implementation

A comprehensive database schema implementation using Drizzle ORM with PostgreSQL, featuring 11 interconnected tables for a data management system.

## Database Schema

The schema includes the following tables:

### Core Tables
- **users** - User management with email, name, and timestamps
- **workspaces** - Workspace organization owned by users
- **folders** - Hierarchical folder structure within workspaces
- **tables** - Data tables within folders with archiving support
- **columns** - Table column definitions with types and computed column support
- **rows** - Table row entries with soft deletion
- **cells** - Individual cell data with formula support

### System Tables
- **shares** - Sharing permissions for tables and folders
- **api_keys** - API access management with scoped permissions
- **audits** - Activity tracking and change history
- **snapshots** - Table data snapshots for backups

### Key Features
- ✅ **11 tables** with proper relationships
- ✅ **Foreign key constraints** maintaining data integrity
- ✅ **Indexes** for performance optimization:
  - `rows(table_id, updated_at)` for efficient row queries
  - `columns(table_id, position)` for column ordering
  - `cells(row_id)` for cell lookups
- ✅ **Check constraints** for data validation
- ✅ **Self-referencing relationships** (folders hierarchy)
- ✅ **Soft deletion** support (rows.deleted_at)
- ✅ **Computed columns** and **formula support**

## Setup Instructions

### 1. Prerequisites
- Node.js 18+ installed
- PostgreSQL database (local or hosted)

### 2. Environment Configuration
```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit .env.local with your database credentials
DATABASE_URL="postgresql://username:password@localhost:5432/datatables"
```

### 3. Database Setup Options

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database
createdb datatables
```

#### Option B: Online Database Providers
The schema is compatible with all major PostgreSQL providers:

**Vercel Postgres:**
```bash
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.postgres.vercel-storage.com/verceldb"
```

**Supabase:**
```bash
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
```

**Railway:**
```bash
DATABASE_URL="postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway"
```

**Neon:**
```bash
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/dbname"
```

### 4. Run Migrations

```bash
# Install dependencies (if not already done)
npm install

# Generate migrations (already generated)
npm run db:generate

# Run migrations to create all tables
npm run db:migrate

# Optional: Seed database with sample data
npm run db:seed
```

### 5. Verify Setup

```bash
# Open Drizzle Studio to view your database
npm run db:studio
```

## Migration Files

The migration system generates SQL files in the `/drizzle` directory:

- `0000_needy_maestro.sql` - Initial schema creation with all 11 tables, relationships, and indexes

## Development Commands

```bash
npm run dev          # Start Next.js development server
npm run db:generate  # Generate new migrations
npm run db:push      # Push schema directly (dev only)
npm run db:studio    # Open Drizzle Studio
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database with sample data
```

## Schema Details

### Table Relationships
- Users own Workspaces
- Workspaces contain Folders (hierarchical)
- Folders contain Tables
- Tables have Columns and Rows
- Rows contain Cells linked to Columns
- Audits track changes to Tables/Rows
- Snapshots store Table data backups
- Shares manage access permissions
- API Keys provide programmatic access

### Performance Optimizations
- Strategic indexes on frequently queried columns
- Connection pooling for database connections
- Proper foreign key relationships for data integrity
- Check constraints for data validation

### Migration Strategy
- Version-controlled migrations for schema changes
- Support for both development and production deployments
- Compatible with popular PostgreSQL hosting providers
- Environment-based configuration for different stages

## Next Steps

1. Set up your PostgreSQL database
2. Configure your `.env.local` file
3. Run migrations: `npm run db:migrate`
4. Optional: Seed data: `npm run db:seed`
5. Start building your application with type-safe database access

The schema is now ready for development and can be easily migrated to production databases when needed.
