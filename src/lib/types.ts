// Type definitions for API operations

export interface FilterOperation {
  column: string;
  operator: '=' | '!=' | 'contains' | '>' | '<' | '>=' | '<=' | 'is_null' | 'is_not_null';
  value?: string | number | boolean | null;
}

export interface SortOperation {
  column: string;
  direction: 'asc' | 'desc';
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface RowQueryParams extends PaginationParams {
  filter?: FilterOperation[];
  sort?: SortOperation[];
}

export interface ColumnConfig {
  required?: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface CreateColumnRequest {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'email' | 'url' | 'json';
  config?: ColumnConfig;
  position?: number;
}

export interface UpdateColumnRequest {
  name?: string;
  type?: 'text' | 'number' | 'boolean' | 'date' | 'email' | 'url' | 'json';
  config?: ColumnConfig;
  position?: number;
}

export interface CreateRowRequest {
  data: Record<string, any>;
  formulas?: Record<string, string>; // columnName -> formula
}

export interface UpdateRowRequest {
  data: Record<string, any>;
  formulas?: Record<string, string>; // columnName -> formula
}

export interface BulkCreateRowsRequest {
  rows: CreateRowRequest[];
}

export interface AuditLogEntry {
  id: number;
  userId: number;
  tableId: number;
  rowId?: number;
  action: string;
  diffJson?: string;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
}