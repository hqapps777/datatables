import { db } from '@/server/db';
import { audits } from '@/server/db/schema';

export interface AuditContext {
  userId: number;
  tableId: number;
  rowId?: number;
}

export interface AuditDiff {
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: Record<string, { from: any; to: any }>;
}

export class AuditLogger {
  static async log(
    context: AuditContext,
    action: string,
    diff?: AuditDiff
  ): Promise<void> {
    try {
      await db.insert(audits).values({
        userId: context.userId,
        tableId: context.tableId,
        rowId: context.rowId,
        action,
        diffJson: diff ? JSON.stringify(diff) : null,
      });
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw here to avoid breaking the main operation
    }
  }

  static async logColumnCreate(
    context: AuditContext,
    columnData: Record<string, any>
  ): Promise<void> {
    await this.log(context, 'column_create', {
      after: columnData,
    });
  }

  static async logColumnUpdate(
    context: AuditContext,
    before: Record<string, any>,
    after: Record<string, any>
  ): Promise<void> {
    const changes: Record<string, { from: any; to: any }> = {};
    
    for (const key in after) {
      if (before[key] !== after[key]) {
        changes[key] = { from: before[key], to: after[key] };
      }
    }

    await this.log(context, 'column_update', {
      before,
      after,
      changes,
    });
  }

  static async logColumnDelete(
    context: AuditContext,
    columnData: Record<string, any>
  ): Promise<void> {
    await this.log(context, 'column_delete', {
      before: columnData,
    });
  }

  static async logRowCreate(
    context: AuditContext,
    rowData: Record<string, any>
  ): Promise<void> {
    await this.log(context, 'row_create', {
      after: rowData,
    });
  }

  static async logRowUpdate(
    context: AuditContext,
    before: Record<string, any>,
    after: Record<string, any>
  ): Promise<void> {
    const changes: Record<string, { from: any; to: any }> = {};
    
    for (const key in after) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes[key] = { from: before[key], to: after[key] };
      }
    }

    await this.log(context, 'row_update', {
      before,
      after,
      changes,
    });
  }

  static async logRowDelete(
    context: AuditContext,
    rowData: Record<string, any>
  ): Promise<void> {
    await this.log(context, 'row_delete', {
      before: rowData,
    });
  }

  static async logBulkRowCreate(
    context: AuditContext,
    rowsData: Record<string, any>[]
  ): Promise<void> {
    await this.log(context, 'bulk_row_create', {
      after: { count: rowsData.length, rows: rowsData },
    });
  }
}