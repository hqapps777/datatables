import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/server/db';
import { tables, columns, rows, cells } from '@/server/db/schema';
import { withAuth } from '@/lib/auth-middleware';
import { FormulaIntegration } from '@/lib/formula/integration';
import { A1NotationMapper, FormulaEngine } from '@/lib/formula/engine';
import { handleApiError, NotFoundError } from '@/lib/validation';
import { ApiResponse } from '@/lib/types';

interface Params {
  params: {
    id: string;
  };
}

/**
 * GET /api/tables/[id]/formulas - Get all formulas in a table
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

    // Get all formula cells
    const formulaCells = await FormulaIntegration.getFormulaCells(tableId);

    const response: ApiResponse = {
      data: formulaCells,
      metadata: {
        total: formulaCells.length,
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

/**
 * POST /api/tables/[id]/formulas/validate - Validate a formula without executing
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
    requiredPermission: 'view' // Just viewing for validation
  });

  if (!authResult.success) {
    return authResult.response!;
  }

  try {
    const body = await request.json();
    const { formula } = body;

    if (!formula || typeof formula !== 'string') {
      return NextResponse.json({ 
        error: 'Formula is required and must be a string' 
      }, { status: 400 });
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

    // Validate the formula
    const validation = await FormulaIntegration.evaluateFormulaPreview(tableId, formula);

    const response: ApiResponse = {
      data: {
        formula,
        isValid: validation.isValid,
        value: validation.value,
        error: validation.error,
      },
      message: validation.isValid ? 'Formula is valid' : 'Formula is invalid',
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorResponse = handleApiError(error as Error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}