import { NextRequest, NextResponse } from 'next/server';
import { FormulaEngine } from '@/lib/formula/engine';
import { CrossTableFormulaEngine } from '@/lib/formula/cross-table-engine';
import { db } from '@/server/db';
import { tables, cells, rows } from '@/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Manual recalculation endpoint for volatile functions
 * POST /api/tables/[id]/recalc
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tableId = parseInt(id);

    if (isNaN(tableId)) {
      return NextResponse.json(
        { error: 'Invalid table ID' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      forceRecalc = false,
      includeVolatile = true,
      maxCells = 1000
    } = body;

    console.log(`Manual recalculation triggered for table ${tableId}`);
    console.log(`Options: forceRecalc=${forceRecalc}, includeVolatile=${includeVolatile}, maxCells=${maxCells}`);

    // Check if table exists
    const table = await db
      .select({ id: tables.id, name: tables.name })
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (table.length === 0) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Get formula engine instance
    const engine = await FormulaEngine.getInstance(tableId);
    const startTime = Date.now();
    
    // Get all cells with formulas
    const formulaCells = await db
      .select({
        id: cells.id,
        rowId: cells.rowId,
        columnId: cells.columnId,
        formula: cells.formula,
        valueJson: cells.valueJson,
      })
      .from(cells)
      .innerJoin(rows, eq(cells.rowId, rows.id))
      .where(and(
        eq(rows.tableId, tableId),
        isNull(rows.deletedAt)
      ))
      .limit(maxCells);
    
    // Filter to only cells with formulas
    const filteredFormulaCells = formulaCells.filter(cell => cell.formula != null);

    console.log(`Found ${filteredFormulaCells.length} cells with formulas`);

    const recalcResults: Array<{
      cellId: number;
      rowId: number;
      columnId: number;
      formula: string;
      oldValue: any;
      newValue: any;
      changed: boolean;
      error?: string;
    }> = [];

    const volatileFunctions = ['NOW()', 'TODAY()', 'RAND()', 'RANDBETWEEN('];
    let volatileCellsCount = 0;
    let changedCellsCount = 0;
    let errorCellsCount = 0;

    // Process each formula cell
    for (const cell of filteredFormulaCells) {
      try {
        const oldValue = cell.valueJson ? JSON.parse(cell.valueJson) : null;
        const formula = cell.formula!;
        
        // Check if this is a volatile function
        const isVolatile = includeVolatile && volatileFunctions.some(vf => 
          formula.toUpperCase().includes(vf.toUpperCase())
        );
        
        // Only recalculate if forced or if it's a volatile function
        if (!forceRecalc && !isVolatile) {
          continue;
        }

        if (isVolatile) {
          volatileCellsCount++;
        }

        // Get cell mapper and convert to A1 notation
        const cellMapper = engine.getCellMapper();
        const a1Ref = cellMapper.cellToA1(cell.rowId, cell.columnId);
        
        if (!a1Ref) {
          console.warn(`Could not convert cell ${cell.rowId},${cell.columnId} to A1 notation`);
          continue;
        }

        // Force recalculation by setting the formula again
        await engine.setCellFormula(a1Ref, formula);
        const result = await engine.evaluateCell(a1Ref);
        
        const newValue = result.value;
        const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);
        
        if (hasChanged) {
          changedCellsCount++;
          
          // Update the database with new value
          await db
            .update(cells)
            .set({
              valueJson: JSON.stringify(newValue),
              calcVersion: Math.floor(Date.now() / 1000) // Unix timestamp as calc version
            })
            .where(eq(cells.id, cell.id));
        }

        if (result.error) {
          errorCellsCount++;
        }

        recalcResults.push({
          cellId: cell.id,
          rowId: cell.rowId,
          columnId: cell.columnId,
          formula: formula,
          oldValue: oldValue,
          newValue: newValue,
          changed: hasChanged,
          error: result.error
        });

      } catch (error) {
        errorCellsCount++;
        console.error(`Error recalculating cell ${cell.id}:`, error);
        
        recalcResults.push({
          cellId: cell.id,
          rowId: cell.rowId,
          columnId: cell.columnId,
          formula: cell.formula!,
          oldValue: null,
          newValue: null,
          changed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const duration = Date.now() - startTime;

    const summary = {
      tableId: tableId,
      tableName: table[0].name,
      totalCells: filteredFormulaCells.length,
      processedCells: recalcResults.length,
      volatileCells: volatileCellsCount,
      changedCells: changedCellsCount,
      errorCells: errorCellsCount,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      options: {
        forceRecalc,
        includeVolatile,
        maxCells
      }
    };

    console.log('Recalculation summary:', summary);

    // Return detailed results
    return NextResponse.json({
      success: true,
      summary,
      results: forceRecalc ? recalcResults : recalcResults.filter(r => r.changed || r.error), // Only return changes unless forced
      message: `Recalculated ${changedCellsCount} cells in ${duration}ms`
    });

  } catch (error) {
    console.error('Manual recalculation failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Recalculation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get recalculation status and statistics
 * GET /api/tables/[id]/recalc
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tableId = parseInt(id);

    if (isNaN(tableId)) {
      return NextResponse.json(
        { error: 'Invalid table ID' },
        { status: 400 }
      );
    }

    // Check if table exists
    const table = await db
      .select({ id: tables.id, name: tables.name })
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (table.length === 0) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    // Get statistics about formulas in this table
    const formulaStats = await db
      .select({
        rowId: cells.rowId,
        columnId: cells.columnId,
        formula: cells.formula,
        calcVersion: cells.calcVersion,
      })
      .from(cells)
      .innerJoin(rows, eq(cells.rowId, rows.id))
      .where(and(
        eq(rows.tableId, tableId),
        isNull(rows.deletedAt)
      ));
    
    // Filter to only cells with formulas
    const filteredFormulaStats = formulaStats.filter(cell => cell.formula != null);

    const volatileFunctions = ['NOW()', 'TODAY()', 'RAND()', 'RANDBETWEEN('];
    
    const stats = {
      tableId: tableId,
      tableName: table[0].name,
      totalFormulaCells: filteredFormulaStats.length,
      volatileCells: filteredFormulaStats.filter(cell =>
        volatileFunctions.some(vf =>
          cell.formula?.toUpperCase().includes(vf.toUpperCase())
        )
      ).length,
      lastCalcVersion: Math.max(...filteredFormulaStats.map(c => c.calcVersion || 0), 0),
      volatileFunctionTypes: volatileFunctions.map(vf => ({
        function: vf,
        count: filteredFormulaStats.filter(cell =>
          cell.formula?.toUpperCase().includes(vf.toUpperCase())
        ).length
      })).filter(item => item.count > 0),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      stats,
      endpoints: {
        recalculate: {
          method: 'POST',
          url: `/api/tables/${tableId}/recalc`,
          options: {
            forceRecalc: 'boolean - recalculate all formulas (default: false)',
            includeVolatile: 'boolean - include volatile functions (default: true)', 
            maxCells: 'number - maximum cells to process (default: 1000)'
          }
        }
      }
    });

  } catch (error) {
    console.error('Get recalc status failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get recalculation status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}