import { eq, ne, gt, lt, gte, lte, like, isNull, isNotNull, SQL, and, or, asc, desc } from 'drizzle-orm';
import { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { FilterOperation, SortOperation, PaginationParams } from './types';

export class QueryBuilder {
  static buildFilterConditions(
    filters: FilterOperation[],
    columnMap: Record<string, PgColumn>
  ): SQL[] {
    const conditions: SQL[] = [];

    for (const filter of filters) {
      const column = columnMap[filter.column];
      if (!column) {
        continue; // Skip unknown columns
      }

      switch (filter.operator) {
        case '=':
          if (filter.value !== undefined) {
            conditions.push(eq(column, filter.value));
          }
          break;
        case '!=':
          if (filter.value !== undefined) {
            conditions.push(ne(column, filter.value));
          }
          break;
        case '>':
          if (filter.value !== undefined) {
            conditions.push(gt(column, filter.value));
          }
          break;
        case '<':
          if (filter.value !== undefined) {
            conditions.push(lt(column, filter.value));
          }
          break;
        case '>=':
          if (filter.value !== undefined) {
            conditions.push(gte(column, filter.value));
          }
          break;
        case '<=':
          if (filter.value !== undefined) {
            conditions.push(lte(column, filter.value));
          }
          break;
        case 'contains':
          if (filter.value !== undefined) {
            conditions.push(like(column, `%${filter.value}%`));
          }
          break;
        case 'is_null':
          conditions.push(isNull(column));
          break;
        case 'is_not_null':
          conditions.push(isNotNull(column));
          break;
      }
    }

    return conditions;
  }

  static buildSortConditions(
    sorts: SortOperation[],
    columnMap: Record<string, PgColumn>
  ): SQL[] {
    const conditions: SQL[] = [];

    for (const sort of sorts) {
      const column = columnMap[sort.column];
      if (!column) {
        continue; // Skip unknown columns
      }

      if (sort.direction === 'asc') {
        conditions.push(asc(column));
      } else {
        conditions.push(desc(column));
      }
    }

    return conditions;
  }

  static buildPagination(params: PaginationParams): {
    limit: number;
    offset: number;
    page: number;
    pageSize: number;
  } {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
    const offset = (page - 1) * pageSize;

    return {
      limit: pageSize,
      offset,
      page,
      pageSize,
    };
  }

  static parseFiltersFromUrl(searchParams: URLSearchParams): FilterOperation[] {
    const filters: FilterOperation[] = [];
    
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('filter[') && key.endsWith(']')) {
        // Extract column name: filter[column_name]
        const column = key.slice(7, -1);
        
        // Parse operator and value from the value string
        // Format: "operator:value" or just "value" (defaults to =)
        const [operator, ...valueParts] = value.split(':');
        const filterValue = valueParts.length > 0 ? valueParts.join(':') : operator;
        const filterOperator = valueParts.length > 0 ? operator as FilterOperation['operator'] : '=';

        // Convert string values to appropriate types
        let parsedValue: any = filterValue;
        if (filterOperator !== 'is_null' && filterOperator !== 'is_not_null') {
          if (filterValue === 'null') {
            parsedValue = null;
          } else if (filterValue === 'true') {
            parsedValue = true;
          } else if (filterValue === 'false') {
            parsedValue = false;
          } else if (!isNaN(Number(filterValue)) && filterValue !== '') {
            parsedValue = Number(filterValue);
          }
        }

        filters.push({
          column,
          operator: filterOperator,
          value: parsedValue,
        });
      }
    }

    return filters;
  }

  static parseSortsFromUrl(searchParams: URLSearchParams): SortOperation[] {
    const sorts: SortOperation[] = [];
    
    const sortParam = searchParams.get('sort');
    if (sortParam) {
      const sortParts = sortParam.split(',');
      
      for (const part of sortParts) {
        if (part.startsWith('-')) {
          sorts.push({
            column: part.slice(1),
            direction: 'desc',
          });
        } else if (part.startsWith('+')) {
          sorts.push({
            column: part.slice(1),
            direction: 'asc',
          });
        } else {
          sorts.push({
            column: part,
            direction: 'asc',
          });
        }
      }
    }

    return sorts;
  }

  static parsePaginationFromUrl(searchParams: URLSearchParams): PaginationParams {
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    return { page, pageSize };
  }
}

export function validateColumnType(type: string): boolean {
  const validTypes = ['text', 'number', 'boolean', 'date', 'email', 'url', 'json'];
  return validTypes.includes(type);
}

export function validateFilterOperator(operator: string): boolean {
  const validOperators = ['=', '!=', 'contains', '>', '<', '>=', '<=', 'is_null', 'is_not_null'];
  return validOperators.includes(operator);
}

export function validateSortDirection(direction: string): boolean {
  return ['asc', 'desc'].includes(direction);
}