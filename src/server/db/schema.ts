import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  boolean,
  text,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Magic Links table for authentication
export const magicLinks = pgTable('magic_links', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Workspaces table
export const workspaces = pgTable('workspaces', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerUserId: integer('owner_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Folders table (self-referencing)
export const folders = pgTable('folders', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  parentFolderId: integer('parent_folder_id'), // Will be handled by relations
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Tables table
export const tables = pgTable('tables', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  folderId: integer('folder_id').notNull().references(() => folders.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isArchived: boolean('is_archived').notNull().default(false),
});

// Columns table with index
export const columns = pgTable(
  'columns',
  {
    id: serial('id').primaryKey(),
    tableId: integer('table_id').notNull().references(() => tables.id),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    configJson: text('config_json'),
    position: integer('position').notNull(),
    isComputed: boolean('is_computed').notNull().default(false),
    formula: text('formula'),
  },
  (table) => ({
    tableIdPositionIdx: index('columns_table_id_position_idx').on(table.tableId, table.position),
  })
);

// Rows table with index
export const rows = pgTable(
  'rows',
  {
    id: serial('id').primaryKey(),
    tableId: integer('table_id').notNull().references(() => tables.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    tableIdUpdatedAtIdx: index('rows_table_id_updated_at_idx').on(table.tableId, table.updatedAt),
  })
);

// Cells table with index
export const cells = pgTable(
  'cells',
  {
    id: serial('id').primaryKey(),
    rowId: integer('row_id').notNull().references(() => rows.id),
    columnId: integer('column_id').notNull().references(() => columns.id),
    valueJson: text('value_json'),
    formula: text('formula'),
    errorCode: text('error_code'),
    calcVersion: integer('calc_version').notNull().default(0),
  },
  (table) => ({
    rowIdIdx: index('cells_row_id_idx').on(table.rowId),
  })
);

// Shares table with check constraints
export const shares = pgTable(
  'shares',
  {
    id: serial('id').primaryKey(),
    targetType: text('target_type').notNull(),
    targetId: integer('target_id').notNull(),
    role: text('role').notNull(),
    email: varchar('email', { length: 255 }),
    publicSlug: varchar('public_slug', { length: 255 }).unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    targetTypeCheck: check('target_type_check', sql`${table.targetType} IN ('table', 'folder')`),
    roleCheck: check('role_check', sql`${table.role} IN ('viewer', 'editor', 'public')`),
  })
);

// API Keys table with check constraints
export const apiKeys = pgTable(
  'api_keys',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    scope: text('scope').notNull(),
    scopeId: integer('scope_id').notNull(),
    role: text('role').notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => ({
    scopeCheck: check('scope_check', sql`${table.scope} IN ('workspace', 'table')`),
    roleCheck: check('api_keys_role_check', sql`${table.role} IN ('viewer', 'editor', 'owner')`),
  })
);

// Audits table
export const audits = pgTable('audits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  tableId: integer('table_id').notNull().references(() => tables.id),
  rowId: integer('row_id').references(() => rows.id),
  action: text('action').notNull(),
  diffJson: text('diff_json'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Snapshots table
export const snapshots = pgTable('snapshots', {
  id: serial('id').primaryKey(),
  tableId: integer('table_id').notNull().references(() => tables.id),
  label: varchar('label', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  dataJson: text('data_json').notNull(),
});

// Relations for better type inference and joins
export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
  audits: many(audits),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerUserId],
    references: [users.id],
  }),
  folders: many(folders),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [folders.workspaceId],
    references: [workspaces.id],
  }),
  tables: many(tables),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  folder: one(folders, {
    fields: [tables.folderId],
    references: [folders.id],
  }),
  columns: many(columns),
  rows: many(rows),
  audits: many(audits),
  snapshots: many(snapshots),
}));

export const columnsRelations = relations(columns, ({ one, many }) => ({
  table: one(tables, {
    fields: [columns.tableId],
    references: [tables.id],
  }),
  cells: many(cells),
}));

export const rowsRelations = relations(rows, ({ one, many }) => ({
  table: one(tables, {
    fields: [rows.tableId],
    references: [tables.id],
  }),
  cells: many(cells),
  audits: many(audits),
}));

export const cellsRelations = relations(cells, ({ one }) => ({
  row: one(rows, {
    fields: [cells.rowId],
    references: [rows.id],
  }),
  column: one(columns, {
    fields: [cells.columnId],
    references: [columns.id],
  }),
}));

export const auditsRelations = relations(audits, ({ one }) => ({
  user: one(users, {
    fields: [audits.userId],
    references: [users.id],
  }),
  table: one(tables, {
    fields: [audits.tableId],
    references: [tables.id],
  }),
  row: one(rows, {
    fields: [audits.rowId],
    references: [rows.id],
  }),
}));

export const snapshotsRelations = relations(snapshots, ({ one }) => ({
  table: one(tables, {
    fields: [snapshots.tableId],
    references: [tables.id],
  }),
}));
