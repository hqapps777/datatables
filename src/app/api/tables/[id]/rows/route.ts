import { NextRequest, NextResponse } from 'next/server';
import { eq, and, inArray, sql, count } from 'drizzle-orm';
import { db } from '@/server/db';
import { tables, rows, columns, cells } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { AuditLogger } from '@/lib/audit-logger';
import { QueryBuilder } from '@/lib/query-helpers';
import { CreateRowRequest, BulkCreateRowsRequest, ApiResponse } from '@/lib/types';
import { createRowSchema, bulkCreateRowsSchema, handleApiError, NotFoundError, ValidationError, validateCellValue } from '@/lib/validation';
import { FormulaIntegration } from '@/lib/formula/integration';

interface Params {
  params: {
    id: string;
  };
}

/**
 * GET /api/tables/[id]/rows - Get rows with filtering, sorting, and pagination
 * Requires: view permission on table
 * Query params: filter[column]=operator:value, sort=column1,-column2, page=1, pageSize=10
 */
export async function GET(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const tableId = parseInt(resolvedParams.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'view'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    // Verify table exists
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      throw new NotFoundError('Table not found');
    }

    // Get table columns for validation and mapping
    const tableColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    // Create column map for query building
    const columnMap: Record<string, any> = {
      'id': rows.id,
      'createdAt': rows.createdAt,
      'updatedAt': rows.updatedAt,
    };

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters = QueryBuilder.parseFiltersFromUrl(searchParams);
    const sorts = QueryBuilder.parseSortsFromUrl(searchParams);
    const pagination = QueryBuilder.parsePaginationFromUrl(searchParams);

    // Build filter conditions
    const filterConditions = QueryBuilder.buildFilterConditions(filters, columnMap);
    const sortConditions = QueryBuilder.buildSortConditions(sorts, columnMap);
    const { limit, offset, page, pageSize } = QueryBuilder.buildPagination(pagination);

    // Get total count for pagination
    const whereCondition = filterConditions.length > 0 
      ? and(eq(rows.tableId, tableId), ...filterConditions)
      : eq(rows.tableId, tableId);

    const totalResult = await db
      .select({ count: count() })
      .from(rows)
      .where(whereCondition);

    const total = totalResult[0]?.count || 0;

    // Build main query with proper chaining
    const baseQuery = db
      .select({
        id: rows.id,
        createdAt: rows.createdAt,
        updatedAt: rows.updatedAt,
      })
      .from(rows)
      .where(whereCondition);

    // Execute query with sorting and pagination
    const tableRows = await baseQuery
      .orderBy(sortConditions.length > 0 ? sortConditions[0] : rows.updatedAt)
      .limit(limit)
      .offset(offset);

    // Get cells for all returned rows
    const rowIds = tableRows.map(row => row.id);
    const tableCells = rowIds.length > 0 ? await db
      .select()
      .from(cells)
      .where(inArray(cells.rowId, rowIds)) : [];

    // Group cells by row and column
    const cellsByRow: Record<number, Record<number, any>> = {};
    for (const cell of tableCells) {
      if (!cellsByRow[cell.rowId]) {
        cellsByRow[cell.rowId] = {};
      }
      cellsByRow[cell.rowId][cell.columnId] = {
        value: cell.valueJson ? JSON.parse(cell.valueJson) : null,
        formula: cell.formula,
        errorCode: cell.errorCode,
      };
    }

    // Build row data with column values
    const rowsWithData = tableRows.map(row => {
      const rowData: Record<string, any> = {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        data: {},
      };

      // Add column data
      for (const column of tableColumns) {
        const cellData = cellsByRow[row.id]?.[column.id];
        rowData.data[column.name] = cellData?.value || null;
        
        if (cellData?.formula) {
          rowData.data[`${column.name}_formula`] = cellData.formula;
        }
        if (cellData?.errorCode) {
          rowData.data[`${column.name}_error`] = cellData.errorCode;
        }
      }

      return rowData;
    });

    const totalPages = Math.ceil(total / pageSize);

    const response: ApiResponse = {
      data: rowsWithData,
      metadata: {
        total,
        page,
        pageSize,
        totalPages,
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

/**
 * POST /api/tables/[id]/rows - Create new row(s)
 * Requires: edit permission on table
 * Body: CreateRowRequest | BulkCreateRowsRequest
 */
export async function POST(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const tableId = parseInt(resolvedParams.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'edit'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    // Verify table exists
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      throw new NotFoundError('Table not found');
    }

    // Get table columns
    const tableColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.tableId, tableId))
      .orderBy(columns.position);

    const columnMap = new Map(tableColumns.map(col => [col.name, col]));

    const body = await request.json();

    // Check if it's bulk creation and validate accordingly
    const isBulk = 'rows' in body;
    
    if (isBulk) {
      const validationResult = bulkCreateRowsSchema.safeParse(body);
      if (!validationResult.success) {
        const errorResponse = handleApiError(validationResult.error);
        return NextResponse.json(errorResponse, { status: errorResponse.status });
      }
    } else {
      const validationResult = createRowSchema.safeParse(body);
      if (!validationResult.success) {
        const errorResponse = handleApiError(validationResult.error);
        return NextResponse.json(errorResponse, { status: errorResponse.status });
      }
    }

    const rowsToCreate = isBulk ? (body as BulkCreateRowsRequest).rows : [body as CreateRowRequest];
    
    const createdRows: any[] = [];

    // Process each row
    for (const rowData of rowsToCreate) {
      // Create the row record first
      const newRow = await db
        .insert(rows)
        .values({
          tableId,
        })
        .returning();

      const rowId = newRow[0].id;

      // Prepare cell updates for formula processing
      const cellUpdates: Array<{
        rowId: number;
        columnId: number;
        value: any;
        formula?: string;
      }> = [];

      // Process data with potential formulas
      for (const [columnName, value] of Object.entries(rowData.data)) {
        const column = columnMap.get(columnName);
        if (column) {
          const config = column.configJson ? JSON.parse(column.configJson) : null;
          
          // Check if this is a formula (starts with =) or if we have a separate formula
          const cellFormula = rowData.formulas?.[columnName] || (typeof value === 'string' && value.startsWith('=') ? value : undefined);
          const cellValue = cellFormula ? null : value;
          
          if (!cellFormula) {
            // Validate non-formula values
            const validation = validateCellValue(cellValue, column.type, config);
            if (!validation.isValid) {
              throw new ValidationError(`Invalid value for column '${columnName}' in row ${rowId}: ${validation.error}`, columnName);
            }
          }

          cellUpdates.push({
            rowId,
            columnId: column.id,
            value: cellValue,
            formula: cellFormula,
          });
        }
      }

      // Process cells with formula integration
      if (cellUpdates.length > 0) {
        const formulaResult = await FormulaIntegration.updateMultipleCells(tableId, cellUpdates);

        // Insert processed cells
        const cellsToInsert: any[] = [];
        
        for (const result of formulaResult.results) {
          cellsToInsert.push({
            rowId: result.rowId,
            columnId: result.columnId,
            valueJson: result.value !== null && result.value !== undefined ? JSON.stringify(result.value) : null,
            formula: result.formula || null,
            errorCode: result.error || null,
          });
        }

        if (cellsToInsert.length > 0) {
          await db.insert(cells).values(cellsToInsert);
        }

        // Update any affected cells from formula recalculation
        for (const affectedCell of formulaResult.affectedCells) {
          const existingCell = await db
            .select()
            .from(cells)
            .where(and(
              eq(cells.rowId, affectedCell.rowId),
              eq(cells.columnId, affectedCell.columnId)
            ))
            .limit(1);

          if (existingCell[0]) {
            await db
              .update(cells)
              .set({
                valueJson: affectedCell.value !== null ? JSON.stringify(affectedCell.value) : null,
                errorCode: affectedCell.error || null,
                calcVersion: existingCell[0].calcVersion + 1,
              })
              .where(eq(cells.id, existingCell[0].id));
          }
        }
      }

      // Log audit entry
      if (authResult.context?.permissionContext.userId) {
        await AuditLogger.logRowCreate(
          {
            userId: authResult.context.permissionContext.userId,
            tableId,
            rowId,
          },
          {
            rowId,
            data: rowData.data,
            formulas: rowData.formulas,
          }
        );
      }

      createdRows.push({
        id: rowId,
        createdAt: newRow[0].createdAt,
        updatedAt: newRow[0].updatedAt,
        data: rowData.data,
        formulas: rowData.formulas,
      });
    }

    // Log bulk creation if applicable
    if (isBulk && authResult.context?.permissionContext.userId) {
      await AuditLogger.logBulkRowCreate(
        {
          userId: authResult.context.permissionContext.userId,
          tableId,
        },
        createdRows.map(row => ({ rowId: row.id, data: row.data }))
      );
    }

    const response: ApiResponse = {
      data: isBulk ? createdRows : createdRows[0],
      message: isBulk 
        ? `${createdRows.length} rows created successfully`
        : 'Row created successfully',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating rows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/tables/[id]/rows - Update row order (for drag & drop)
 * Requires: edit permission on table
 * Body: { rowOrder: number[] }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const tableId = parseInt(resolvedParams.id);

  if (isNaN(tableId)) {
    return NextResponse.json({ error: 'Invalid table ID' }, { status: 400 });
  }

  // Authenticate and authorize
  const authResult = await withAuth(request, {
    tableId,
    requiredPermission: 'edit'
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    const body = await request.json();
    const { rowOrder } = body;

    if (!Array.isArray(rowOrder) || !rowOrder.every(id => typeof id === 'number')) {
      return NextResponse.json({ error: 'Invalid rowOrder format' }, { status: 400 });
    }

    // Verify table exists
    const table = await db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table[0]) {
      throw new NotFoundError('Table not found');
    }

    // Verify all row IDs exist and belong to this table
    const existingRows = await db
      .select({ id: rows.id })
      .from(rows)
      .where(and(eq(rows.tableId, tableId), inArray(rows.id, rowOrder)));

    if (existingRows.length !== rowOrder.length) {
      return NextResponse.json({ error: 'Some row IDs are invalid' }, { status: 400 });
    }

    // Update formula engine with new row order
    await FormulaIntegration.updateRowOrder(tableId, rowOrder);

    // Note: Row reordering audit logging could be added here if needed

    return NextResponse.json({
      message: 'Row order updated successfully',
      rowOrder: rowOrder,
    });

  } catch (error) {
    console.error('Error updating row order:', error);
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}