'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FormulaBar } from './formula-bar';
import { AlertTriangle, Save, X, GripVertical, Filter, ChevronDown, Edit, Plus, SortAsc, SortDesc, Eye, EyeOff, Trash2, Settings, Columns, Download, Upload, FileText, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CSVColumnMappingDialog } from './csv-column-mapping-dialog';

// Custom checkbox component that supports indeterminate state
const SelectAllCheckbox = ({ checked, indeterminate, onChange, className, title }: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  className?: string;
  title?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className={className}
      title={title}
    />
  );
};

export interface Column {
  id: number;
  name: string;
  type: string;
  position: number;
  isVisible?: boolean;
  isComputed?: boolean;
  formula?: string;
  options?: string[]; // For select type columns
  optionColors?: Record<string, { bg: string; text: string }>; // Separate bg and text colors for select options
}

export interface Cell {
  columnId: number;
  value: any;
  formula?: string;
  errorCode?: string;
}

export interface Row {
  id: number;
  cells: Cell[];
  isHidden?: boolean;
}

export interface ColumnFilter {
  columnId: number;
  type: 'text' | 'number' | 'select' | 'date';
  operator: string;
  value: any;
  value2?: any; // For range filters
}

export interface EnhancedDataTableProps {
  tableId: number;
  columns: Column[];
  rows: Row[];
  onCellUpdate: (rowId: number, columnId: number, value: any, formula?: string, options?: { skipDelay?: boolean }) => Promise<void>;
  onRowsUpdate?: (rows: Row[]) => void;
  onRowAdd?: () => Promise<void>;
  onRowDelete?: (rowIds: number[]) => Promise<void>;
  onRowHide?: (rowIds: number[]) => Promise<void>;
  onRowUnhide?: (rowIds: number[]) => Promise<void>;
  onColumnUpdate?: (columnId: number, updates: Partial<Column>) => Promise<void>;
  onColumnInsert?: (afterColumnId: number, direction: 'left' | 'right') => Promise<void>;
  onColumnDelete?: (columnId: number) => Promise<void>;
  onColumnHide?: (columnId: number) => Promise<void>;
  onCSVImport?: (file: File, mappings?: any) => Promise<void>;
  onCSVExport?: (options?: { includeFormulas?: boolean }) => Promise<void>;
  selectedRows?: Set<number>;
  onSelectedRowsChange?: (selectedRows: Set<number>) => void;
}

export function EnhancedDataTable({
  tableId,
  columns,
  rows,
  onCellUpdate,
  onRowsUpdate,
  onRowAdd,
  onRowDelete,
  onRowHide,
  onColumnUpdate,
  onColumnInsert,
  onColumnDelete,
  onColumnHide,
  onRowUnhide,
  onCSVImport,
  onCSVExport,
  selectedRows: externalSelectedRows,
  onSelectedRowsChange
}: EnhancedDataTableProps) {
  // Undo/Redo State
  interface UndoAction {
    type: 'cell_update' | 'bulk_update' | 'row_delete' | 'row_add';
    timestamp: number;
    data: any;
    description: string;
  }
  
  const [undoHistory, setUndoHistory] = useState<UndoAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // State
  const [focusedCell, setFocusedCell] = useState<{
    rowId: number;
    columnId: number;
    columnName: string;
    value: any;
    formula?: string;
    errorCode?: string;
  } | null>(null);

  // Formula bar range insertion state
  const [formulaBarInsertRange, setFormulaBarInsertRange] = useState<((range: string) => void) | null>(null);

  const [editingCell, setEditingCell] = useState<{
    rowId: number;
    columnId: number;
  } | null>(null);

  const [editValue, setEditValue] = useState('');
  const [pendingValues, setPendingValues] = useState<Map<string, any>>(new Map());
  
  // Select cell editing state
  const [editingSelectCell, setEditingSelectCell] = useState<{
    rowId: number;
    columnId: number;
  } | null>(null);
  const [selectEditValue, setSelectEditValue] = useState('');
  const [selectedRange, setSelectedRange] = useState<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null>(null);

  // Multi-cell selection state
  const [isSelectingCells, setIsSelectingCells] = useState(false);
  const [cellSelectionStart, setCellSelectionStart] = useState<{
    rowId: number;
    columnId: number;
  } | null>(null);

  const [highlightedCells, setHighlightedCells] = useState<Set<string>>(new Set());
  const [dependentCells, setDependentCells] = useState<Set<string>>(new Set());
  
  // Copy & Paste state
  const [copiedCells, setCopiedCells] = useState<{
    data: Array<Array<{ value: any; formula?: string }>>;
    range: { startRow: number; startCol: number; endRow: number; endCol: number };
    isCut?: boolean;
    selectionType?: 'rows' | 'columns' | 'range';
    selectedRowIds?: number[];
    selectedColumnIds?: number[];
  } | null>(null);

  // Context menu state
  const [cellContextMenu, setCellContextMenu] = useState<{
    x: number;
    y: number;
    rowId: number;
    columnId: number;
  } | null>(null);

  const [columnContextMenu, setColumnContextMenu] = useState<{
    x: number;
    y: number;
    columnId: number;
  } | null>(null);

  // Excel-like selection state
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());
  const [lastSelectedCell, setLastSelectedCell] = useState<{
    rowId: number;
    columnId: number;
  } | null>(null);
  
  // Column and Row Drag-to-Select state
  const [isDraggingColumns, setIsDraggingColumns] = useState(false);
  const [columnDragStart, setColumnDragStart] = useState<number | null>(null);
  const [isDraggingRows, setIsDraggingRows] = useState(false);
  const [rowDragStart, setRowDragStart] = useState<number | null>(null);
  
  // Row selection and drag & drop - use external state if provided
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<number>>(new Set());
  
  // Fix: Ensure consistency between state and setter - both must be external or both internal
  const selectedRows = externalSelectedRows || internalSelectedRows;
  const setSelectedRows = (externalSelectedRows && onSelectedRowsChange) ? onSelectedRowsChange : setInternalSelectedRows;
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Context menu for rows
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIds: number[];
  } | null>(null);
  
  // Column filters
  const [columnFilters, setColumnFilters] = useState<Map<number, ColumnFilter>>(new Map());
  
  // Column sorting
  const [columnSort, setColumnSort] = useState<{
    columnId: number;
    direction: 'asc' | 'desc';
  } | null>(null);
  
  // Column editing
  const [editingColumn, setEditingColumn] = useState<{
    columnId: number;
    name: string;
    type: string;
  } | null>(null);
  
  // Column management dialog
  const [showColumnManager, setShowColumnManager] = useState(false);
  
  // CSV Import/Export state
  const [showCSVImportDialog, setShowCSVImportDialog] = useState(false);
  const [showCSVMappingDialog, setShowCSVMappingDialog] = useState(false);
  const [csvImportFile, setCSVImportFile] = useState<File | null>(null);
  const [csvImportData, setCSVImportData] = useState<any>(null);
  
  // Column resizing with localStorage persistence - fix hydration mismatch
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [isColumnWidthsLoaded, setIsColumnWidthsLoaded] = useState(false);
  
  // Selection bar state
  const [isSelectionBarMinimized, setIsSelectionBarMinimized] = useState(false);

  // Update undo availability when history changes
  useEffect(() => {
    setCanUndo(undoHistory.length > 0);
  }, [undoHistory]);

  // Undo system functions
  const addToUndoHistory = useCallback((action: UndoAction) => {
    setUndoHistory(prev => {
      const newHistory = [...prev, action];
      // Limit history to last 50 actions for performance
      return newHistory.slice(-50);
    });
    console.log('📝 Undo action added:', action.description);
  }, []);

  const performUndo = useCallback(async () => {
    console.log('🚨 UNDO DEBUG - performUndo called!', {
      historyLength: undoHistory.length,
      canUndo,
      timestamp: Date.now()
    });
    
    if (undoHistory.length === 0) {
      console.log('❌ UNDO DEBUG - No history to undo');
      return;
    }
    
    const lastAction = undoHistory[undoHistory.length - 1];
    console.log('🔄 UNDO DEBUG - Performing undo:', {
      action: lastAction.description,
      type: lastAction.type,
      data: lastAction.data,
      timestamp: lastAction.timestamp
    });
    
    try {
      switch (lastAction.type) {
        case 'cell_update':
          const { rowId, columnId, oldValue, oldFormula } = lastAction.data;
          console.log('🔄 UNDO DEBUG - Calling onCellUpdate:', {
            rowId, columnId, oldValue, oldFormula
          });
          await onCellUpdate(rowId, columnId, oldValue, oldFormula);
          break;
        
        case 'bulk_update':
          const { cellUpdates } = lastAction.data;
          console.log('🔄 UNDO DEBUG - Bulk undo:', cellUpdates.length, 'updates');
          // Revert each cell update
          for (const update of cellUpdates) {
            await onCellUpdate(update.rowId, update.columnId, update.oldValue, update.oldFormula);
          }
          break;
          
        // Future: Add more undo types as needed
        default:
          console.warn('❌ UNDO DEBUG - Unknown undo action type:', lastAction.type);
      }
      
      // Remove the undone action from history
      setUndoHistory(prev => {
        const newHistory = prev.slice(0, -1);
        console.log('🔄 UNDO DEBUG - History updated:', {
          oldLength: prev.length,
          newLength: newHistory.length
        });
        return newHistory;
      });
      console.log('✅ UNDO DEBUG - Undo successful!');
      
    } catch (error) {
      console.error('❌ UNDO DEBUG - Undo failed:', error);
    }
  }, [undoHistory, onCellUpdate, canUndo]);

  // 🔄 MOCK INTEGRATION: Listen for mock cell updates to create undo history
  useEffect(() => {
    const handleMockCellUpdate = (event: CustomEvent) => {
      const { detail } = event;
      console.log('🔄 MOCK INTEGRATION: Received mock cell update event:', detail);
      
      // Add to undo history
      addToUndoHistory({
        type: 'cell_update',
        timestamp: Date.now(),
        data: {
          rowId: detail.rowId,
          columnId: detail.columnId,
          oldValue: detail.oldValue,
          oldFormula: detail.oldFormula,
          newValue: detail.newValue,
          newFormula: detail.newFormula
        },
        description: `${detail.columnName} bearbeitet`
      });
    };

    // Add event listener for mock cell updates
    window.addEventListener('mock-cell-updated', handleMockCellUpdate as EventListener);
    console.log('🔄 MOCK INTEGRATION: Event listener registered');

    // Cleanup event listener
    return () => {
      window.removeEventListener('mock-cell-updated', handleMockCellUpdate as EventListener);
      console.log('🔄 MOCK INTEGRATION: Event listener cleaned up');
    };
  }, [addToUndoHistory]);

  // Load column widths after hydration
  useEffect(() => {
    if (typeof window !== 'undefined' && !isColumnWidthsLoaded) {
      const saved = localStorage.getItem(`table-${tableId}-column-widths`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const widthsMap = new Map(Object.entries(parsed).map(([k, v]) => [parseInt(k), v as number]));
          setColumnWidths(widthsMap);
        } catch (e) {
          console.warn('Failed to parse saved column widths:', e);
        }
      }
      setIsColumnWidthsLoaded(true);
    }
  }, [tableId, isColumnWidthsLoaded]);

  // Visible columns
  const visibleColumns = useMemo(() =>
    columns.filter(col => col.isVisible !== false).sort((a, b) => a.position - b.position),
    [columns]
  );
  
  // Filtered and sorted rows (including hidden ones for gap detection)
  const processedRows = useMemo(() => {
    let result = [...rows];
    
    // Apply filters
    if (columnFilters.size > 0) {
      result = result.filter(row => {
        // Don't filter out hidden rows for gap detection
        if (row.isHidden) return true;
        
        return Array.from(columnFilters.values()).every(filter => {
          const cell = row.cells.find(c => c.columnId === filter.columnId);
          const cellValue = cell?.value;
          
          if (cellValue == null || cellValue === '') return false;
          
          switch (filter.type) {
            case 'text':
              const textValue = cellValue.toString().toLowerCase();
              const filterText = filter.value.toLowerCase();
              
              switch (filter.operator) {
                case 'contains': return textValue.includes(filterText);
                case 'equals': return textValue === filterText;
                case 'starts': return textValue.startsWith(filterText);
                case 'ends': return textValue.endsWith(filterText);
                default: return textValue.includes(filterText);
              }
              
            case 'number':
              const numValue = parseFloat(cellValue);
              const filterNum = parseFloat(filter.value);
              
              if (isNaN(numValue) || isNaN(filterNum)) return false;
              
              switch (filter.operator) {
                case 'equals': return numValue === filterNum;
                case 'greater': return numValue > filterNum;
                case 'less': return numValue < filterNum;
                case 'between':
                  const filterNum2 = parseFloat(filter.value2);
                  return !isNaN(filterNum2) && numValue >= filterNum && numValue <= filterNum2;
                default: return numValue === filterNum;
              }
              
            case 'select':
              return cellValue === filter.value;
              
            case 'date':
              // Simple date comparison (could be enhanced)
              const cellDate = new Date(cellValue);
              const filterDate = new Date(filter.value);
              
              switch (filter.operator) {
                case 'equals': return cellDate.toDateString() === filterDate.toDateString();
                case 'after': return cellDate > filterDate;
                case 'before': return cellDate < filterDate;
                default: return cellDate.toDateString() === filterDate.toDateString();
              }
              
            default:
              return true;
          }
        });
      });
    }
    
    // Apply sorting
    if (columnSort) {
      result.sort((a, b) => {
        const cellA = a.cells.find(c => c.columnId === columnSort.columnId);
        const cellB = b.cells.find(c => c.columnId === columnSort.columnId);
        
        const valueA = cellA?.value || '';
        const valueB = cellB?.value || '';
        
        // Determine if values are numbers
        const numA = parseFloat(valueA.toString());
        const numB = parseFloat(valueB.toString());
        const isNumeric = !isNaN(numA) && !isNaN(numB);
        
        let comparison = 0;
        if (isNumeric) {
          comparison = numA - numB;
        } else {
          comparison = valueA.toString().localeCompare(valueB.toString());
        }
        
        return columnSort.direction === 'desc' ? -comparison : comparison;
      });
    }
    
    return result;
  }, [rows, columnFilters, columnSort]);

  // Visible rows (excluding hidden ones)
  const visibleRows = useMemo(() =>
    processedRows.filter(row => !row.isHidden),
    [processedRows]
  );

  // Group consecutive hidden rows
  const hiddenRowGroups = useMemo(() => {
    const groups: Array<{ startId: number; endId: number; rowIds: number[]; afterRowId?: number }> = [];
    const sortedRows = [...processedRows].sort((a, b) => a.id - b.id);
    
    let currentGroup: number[] = [];
    let lastVisibleRowId: number | undefined;
    
    for (const row of sortedRows) {
      if (row.isHidden) {
        currentGroup.push(row.id);
      } else {
        if (currentGroup.length > 0) {
          // End of a hidden group
          groups.push({
            startId: currentGroup[0],
            endId: currentGroup[currentGroup.length - 1],
            rowIds: [...currentGroup],
            afterRowId: lastVisibleRowId
          });
          currentGroup = [];
        }
        lastVisibleRowId = row.id;
      }
    }
    
    // Handle case where hidden rows are at the end
    if (currentGroup.length > 0) {
      groups.push({
        startId: currentGroup[0],
        endId: currentGroup[currentGroup.length - 1],
        rowIds: [...currentGroup],
        afterRowId: lastVisibleRowId
      });
    }
    
    return groups;
  }, [processedRows]);

  // Cell value helper
  const getCellValue = useCallback((rowId: number, columnId: number): Cell | undefined => {
    const row = visibleRows.find(r => r.id === rowId);
    return row?.cells.find(c => c.columnId === columnId);
  }, [visibleRows]);

  // A1 notation helpers
  const columnToLetter = (col: number): string => {
    let result = '';
    while (col > 0) {
      col--;
      result = String.fromCharCode(65 + (col % 26)) + result;
      col = Math.floor(col / 26);
    }
    return result;
  };

  const coordsToA1 = (row: number, col: number): string => {
    return columnToLetter(col) + row;
  };

  const letterToColumn = (letter: string): number => {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result;
  };

  const getA1Ref = useCallback((rowId: number, columnId: number): string => {
    const column = columns.find(col => col.id === columnId);
    
    // Find the current position of this row in the visible rows
    // This ensures A1 references reflect the actual current position after drag & drop
    const currentPosition = visibleRows.findIndex(row => row.id === rowId) + 1;
    
    // If row not found in visible rows, fall back to rowId (for backward compatibility)
    const rowPosition = currentPosition > 0 ? currentPosition : rowId;
    
    const a1Ref = coordsToA1(rowPosition, column?.position || 1);
    
    console.log('🔍 DEBUG: getA1Ref called', {
      rowId,
      columnId,
      currentPosition,
      rowPosition,
      a1Ref,
      visibleRowsLength: visibleRows.length,
      visibleRowIds: visibleRows.map(r => r.id)
    });
    
    return a1Ref;
  }, [columns, visibleRows]);

  const getCellKey = useCallback((rowId: number, columnId: number): string => {
    return `${rowId}-${columnId}`;
  }, []);

  // Cell focus handler
  const handleCellFocus = useCallback((rowId: number, columnId: number) => {
    // Get the most current cell value from rows state directly
    const currentRow = rows.find(r => r.id === rowId);
    const cell = currentRow?.cells.find(c => c.columnId === columnId);
    const column = columns.find(col => col.id === columnId);
    
    // Check for pending updates
    const cellKey = `${rowId}-${columnId}`;
    const pendingValue = pendingValues.get(cellKey);
    
    setFocusedCell({
      rowId,
      columnId,
      columnName: column?.name || '',
      value: pendingValue !== undefined ? pendingValue : cell?.value,
      formula: cell?.formula,
      errorCode: cell?.errorCode,
    });

    // Highlight dependencies if formula exists
    if (cell?.formula) {
      highlightDependencies(cell.formula, rowId, columnId);
    } else {
      setHighlightedCells(new Set());
      setDependentCells(new Set());
    }
  }, [rows, columns, pendingValues]);

  // Dependency highlighting
  const highlightDependencies = useCallback(async (formula: string, currentRow: number, currentCol: number) => {
    const highlighted = new Set<string>();
    const dependents = new Set<string>();
    
    try {
      // Extract cell references from formula (simplified regex)
      const cellRefRegex = /\b([A-Z]+)(\d+)\b/g;
      let match;
      
      while ((match = cellRefRegex.exec(formula)) !== null) {
        const colLetter = match[1];
        const rowNumber = parseInt(match[2], 10);
        const colPosition = letterToColumn(colLetter);
        
        // Find column by position
        const column = columns.find(col => col.position === colPosition);
        if (column) {
          highlighted.add(getCellKey(rowNumber, column.id));
        }
      }
      
      // Find dependent cells (cells that reference current cell)
      const currentA1 = getA1Ref(currentRow, currentCol);
      
      for (const row of rows) {
        for (const cell of row.cells) {
          if (cell.formula && cell.formula.includes(currentA1)) {
            dependents.add(getCellKey(row.id, cell.columnId));
          }
        }
      }
      
      setHighlightedCells(highlighted);
      setDependentCells(dependents);
    } catch (error) {
      console.error('Error highlighting dependencies:', error);
    }
  }, [columns, rows, getA1Ref, getCellKey]);

  // Cell editing
  const handleCellEdit = useCallback((rowId: number, columnId: number, currentValue: string) => {
    console.log('🎯 Starting cell edit:', { rowId, columnId, currentValue });
    setEditingCell({ rowId, columnId });
    setEditValue(currentValue);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingCell) return;
    
    try {
      console.log('🚀 Saving edit:', { editingCell, editValue });
      
      // 🔄 UNDO: Capture old value before change
      const oldCell = getCellValue(editingCell.rowId, editingCell.columnId);
      const column = columns.find(col => col.id === editingCell.columnId);
      
      // Save the pending value immediately for instant display
      const cellKey = `${editingCell.rowId}-${editingCell.columnId}`;
      setPendingValues(prev => {
        const newMap = new Map(prev);
        newMap.set(cellKey, editValue);
        return newMap;
      });
      
      // Store the editing cell info before clearing
      const savedEditingCell = { ...editingCell };
      const savedEditValue = editValue;
      
      // Clear editing state
      setEditingCell(null);
      setEditValue('');
      
      console.log('💾 Calling onCellUpdate with:', {
        rowId: savedEditingCell.rowId,
        columnId: savedEditingCell.columnId,
        value: savedEditValue
      });
      
      // Call the backend update
      await onCellUpdate(savedEditingCell.rowId, savedEditingCell.columnId, savedEditValue);
      
      // 🔄 UNDO: Add to history after successful update
      addToUndoHistory({
        type: 'cell_update',
        timestamp: Date.now(),
        data: {
          rowId: savedEditingCell.rowId,
          columnId: savedEditingCell.columnId,
          oldValue: oldCell?.value,
          oldFormula: oldCell?.formula,
          newValue: savedEditValue
        },
        description: `Zelle ${column?.name || 'Unknown'} bearbeitet`
      });
      
      console.log('✅ Update successful, clearing pending value');
      
      // Clear pending value after successful update
      setPendingValues(prev => {
        const newMap = new Map(prev);
        newMap.delete(cellKey);
        return newMap;
      });
      
    } catch (error) {
      console.error('❌ Error saving cell:', error);
      // On error, remove the pending value to revert
      if (editingCell) {
        const cellKey = `${editingCell.rowId}-${editingCell.columnId}`;
        setPendingValues(prev => {
          const newMap = new Map(prev);
          newMap.delete(cellKey);
          return newMap;
        });
      }
    }
  }, [editingCell, editValue, onCellUpdate, getCellValue, columns, addToUndoHistory]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  // Select cell editing handlers
  const handleSelectCellEdit = useCallback((rowId: number, columnId: number, currentValue: string) => {
    console.log('🎯 Starting select cell edit:', { rowId, columnId, currentValue });
    setEditingSelectCell({ rowId, columnId });
    setSelectEditValue(currentValue);
  }, []);

  const handleSaveSelectEdit = useCallback(async () => {
    if (!editingSelectCell) return;
    
    try {
      console.log('🚀 Saving select edit:', { editingSelectCell, selectEditValue });
      
      const column = columns.find(col => col.id === editingSelectCell.columnId);
      if (!column) return;

      // Add the new value to column options if it doesn't exist
      let updatedOptions = column.options || [];
      const trimmedValue = selectEditValue.trim();
      
      if (trimmedValue && !updatedOptions.includes(trimmedValue)) {
        updatedOptions = [...updatedOptions, trimmedValue];
        
        // Update column with new options
        if (onColumnUpdate) {
          await onColumnUpdate(editingSelectCell.columnId, { options: updatedOptions });
        }
      }
      
      // Store editing info before clearing state
      const savedEditingCell = { ...editingSelectCell };
      const savedEditValue = trimmedValue;
      
      // Clear editing state
      setEditingSelectCell(null);
      setSelectEditValue('');
      
      // Save the cell value
      await onCellUpdate(savedEditingCell.rowId, savedEditingCell.columnId, savedEditValue);
      
      console.log('✅ Select edit successful');
      
    } catch (error) {
      console.error('❌ Error saving select cell:', error);
    }
  }, [editingSelectCell, selectEditValue, columns, onColumnUpdate, onCellUpdate]);

  const handleCancelSelectEdit = useCallback(() => {
    setEditingSelectCell(null);
    setSelectEditValue('');
  }, []);

  // Formula submission
  const handleFormulaSubmit = useCallback(async (formula: string) => {
    if (!focusedCell) return;
    
    try {
      await onCellUpdate(focusedCell.rowId, focusedCell.columnId, null, formula);
      
      // Refresh focus to show new calculated value
      setTimeout(() => {
        handleCellFocus(focusedCell.rowId, focusedCell.columnId);
      }, 100);
    } catch (error) {
      console.error('Error saving formula:', error);
    }
  }, [focusedCell, onCellUpdate, handleCellFocus]);

  const handleFormulaCancel = useCallback(() => {
    // Reset any temporary states
  }, []);

  // Context menu handlers
  const handleCellContextMenu = useCallback((e: React.MouseEvent, rowId: number, columnId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Focus the cell for context operations
    handleCellFocus(rowId, columnId);
    
    setCellContextMenu({
      x: e.clientX,
      y: e.clientY,
      rowId,
      columnId
    });
    
    console.log('🖱️ Cell context menu opened:', { rowId, columnId });
  }, [handleCellFocus]);

  const handleColumnContextMenu = useCallback((e: React.MouseEvent, columnId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Select the entire column
    setSelectedColumns(new Set([columnId]));
    setSelectedRows(new Set());
    setSelectedRange(null);
    setFocusedCell(null);
    
    setColumnContextMenu({
      x: e.clientX,
      y: e.clientY,
      columnId
    });
    
    console.log('🖱️ Column context menu opened:', { columnId });
  }, []);

  // Column selection handlers
  const handleColumnSelect = useCallback((columnId: number, mode: 'single' | 'toggle' | 'range' = 'single') => {
    console.log('🖱️ Column selection:', { columnId, mode });
    
    const newSelection = new Set(selectedColumns);
    
    if (mode === 'toggle') {
      if (newSelection.has(columnId)) {
        newSelection.delete(columnId);
      } else {
        newSelection.add(columnId);
      }
    } else if (mode === 'range' && selectedColumns.size > 0) {
      // Range selection for columns
      const lastSelected = Array.from(selectedColumns)[selectedColumns.size - 1];
      const currentIndex = visibleColumns.findIndex(col => col.id === columnId);
      const lastIndex = visibleColumns.findIndex(col => col.id === lastSelected);
      
      const startIndex = Math.min(currentIndex, lastIndex);
      const endIndex = Math.max(currentIndex, lastIndex);
      
      // Add range to existing selection
      for (let i = startIndex; i <= endIndex; i++) {
        if (visibleColumns[i]) {
          newSelection.add(visibleColumns[i].id);
        }
      }
    } else {
      // Single select mode
      newSelection.clear();
      newSelection.add(columnId);
    }
    
    setSelectedColumns(newSelection);
    // Clear other selections when selecting columns
    setSelectedRows(new Set());
    setSelectedRange(null);
    setFocusedCell(null);
    
    console.log('🔄 Column selection updated:', Array.from(newSelection));
  }, [selectedColumns, visibleColumns]);

  // Column Header Drag-to-Select handlers
  const handleColumnDragStart = useCallback((columnId: number, event: React.MouseEvent) => {
    console.log('📋 Column drag-to-select started:', { columnId });
    event.preventDefault();
    
    // Clear other selections
    setSelectedRows(new Set());
    setSelectedRange(null);
    setFocusedCell(null);
    
    // Start column dragging with visual feedback
    setIsDraggingColumns(true);
    setColumnDragStart(columnId);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    
    // Set initial selection
    setSelectedColumns(new Set([columnId]));
  }, []);

  const handleColumnDragEnter = useCallback((columnId: number) => {
    if (isDraggingColumns && columnDragStart !== null) {
      console.log('📋 Column drag extending to:', { from: columnDragStart, to: columnId });
      
      // Find start and end indices
      const startIndex = visibleColumns.findIndex(col => col.id === columnDragStart);
      const endIndex = visibleColumns.findIndex(col => col.id === columnId);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        // Select all columns in range
        const newSelection = new Set<number>();
        for (let i = minIndex; i <= maxIndex; i++) {
          newSelection.add(visibleColumns[i].id);
        }
        
        setSelectedColumns(newSelection);
        console.log('📋 Column selection extended:', Array.from(newSelection).map(id =>
          visibleColumns.find(col => col.id === id)?.name
        ));
      }
    }
  }, [isDraggingColumns, columnDragStart, visibleColumns]);

  const handleColumnDragEnd = useCallback(() => {
    if (isDraggingColumns) {
      console.log('📋 Column drag-to-select ended:', Array.from(selectedColumns));
      setIsDraggingColumns(false);
      setColumnDragStart(null);
      
      // Reset cursor and user selection
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isDraggingColumns, selectedColumns]);

  // Multi-cell selection and range selection with formula insertion
  const handleCellMouseDown = useCallback((rowId: number, columnId: number, event: React.MouseEvent) => {
    console.log('🖱️ Mouse down on cell:', { rowId, columnId, buttons: event.buttons });
    
    const isEditingFormula = focusedCell && event.shiftKey;
    const isMultiSelection = !event.shiftKey && !event.ctrlKey && !event.metaKey;
    
    if (isEditingFormula) {
      // Formula range selection
      console.log('📐 Starting formula range selection');
      const column = columns.find(col => col.id === columnId);
      if (column) {
        // 🔧 FIXED: Use visual position for formula range selection
        const visualPosition = visibleRows.findIndex(r => r.id === rowId) + 1;
        setSelectedRange({
          startRow: visualPosition,
          startCol: column.position,
          endRow: visualPosition,
          endCol: column.position,
        });
      }
    } else if (isMultiSelection) {
      // Clear any existing selections first
      console.log('🧹 Clearing existing selections before drag-to-select');
      setSelectedRange(null);
      setFocusedCell(null);
      setCopiedCells(null);
      
      // Multi-cell selection - start drag-to-select
      console.log('🎯 Starting new drag-to-select operation');
      event.preventDefault();
      setIsSelectingCells(true);
      setCellSelectionStart({ rowId, columnId });
      
      const column = columns.find(col => col.id === columnId);
      if (column) {
        // 🔧 FIXED: Use visual position for drag-to-select initial range
        const visualPosition = visibleRows.findIndex(r => r.id === rowId) + 1;
        setSelectedRange({
          startRow: visualPosition,
          startCol: column.position,
          endRow: visualPosition,
          endCol: column.position,
        });
        console.log('🎯 Initial selection range set:', {
          startRow: rowId,
          startCol: column.position,
          endRow: rowId,
          endCol: column.position,
        });
      }
    }
  }, [columns, focusedCell]);

  const handleCellMouseEnter = useCallback((rowId: number, columnId: number) => {
    // Only extend selection if we are actively selecting (drag operation in progress)
    if (isSelectingCells && selectedRange) {
      const column = columns.find(col => col.id === columnId);
      if (column) {
        console.log('🖱️ Extending selection to:', { rowId, columnId: column.position });
        // 🔧 FIXED: Use visual position for extending selection during drag
        const visualPosition = visibleRows.findIndex(r => r.id === rowId) + 1;
        setSelectedRange(prev => prev ? {
          ...prev,
          endRow: visualPosition,
          endCol: column.position,
        } : null);
      }
    }
  }, [isSelectingCells, selectedRange, columns]);

  const handleCellMouseUp = useCallback(() => {
    console.log('🖱️ Mouse up - ending selection', { isSelectingCells, hasSelectedRange: !!selectedRange });
    
    if (isSelectingCells) {
      // End the drag-to-select session immediately
      setIsSelectingCells(false);
      setCellSelectionStart(null);
      console.log('🖱️ Drag-to-select completed, selection finalized');
      
      // Clear focus to avoid interference
      setFocusedCell(null);
    }
    
    // For formula range selection with shift key
    if (selectedRange && focusedCell && (
      selectedRange.startRow !== selectedRange.endRow ||
      selectedRange.startCol !== selectedRange.endCol
    )) {
      // Check if this is formula editing (has shift key context)
      const startA1 = coordsToA1(selectedRange.startCol, selectedRange.startRow);
      const endA1 = coordsToA1(selectedRange.endCol, selectedRange.endRow);
      const rangeString = startA1 === endA1 ? startA1 : `${startA1}:${endA1}`;
      
      // Only insert into formula if we have the formula bar callback
      if (formulaBarInsertRange) {
        formulaBarInsertRange(rangeString);
        setSelectedRange(null);
      }
    }
  }, [isSelectingCells, selectedRange, focusedCell, formulaBarInsertRange]);

  // Row Header Drag-to-Select handlers
  const handleRowDragStart = useCallback((rowId: number, event: React.MouseEvent) => {
    console.log('📋 Row drag-to-select started:', { rowId });
    event.preventDefault();
    event.stopPropagation();
    
    // Clear other selections
    setSelectedColumns(new Set());
    setSelectedRange(null);
    setFocusedCell(null);
    
    // Start row dragging with visual feedback
    setIsDraggingRows(true);
    setRowDragStart(rowId);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    
    // Set initial selection
    setSelectedRows(new Set([rowId]));
  }, []);

  const handleRowDragEnter = useCallback((rowId: number) => {
    if (isDraggingRows && rowDragStart !== null) {
      console.log('📋 Row drag extending to:', { from: rowDragStart, to: rowId });
      
      // Find start and end indices in visible rows
      const startIndex = visibleRows.findIndex(row => row.id === rowDragStart);
      const endIndex = visibleRows.findIndex(row => row.id === rowId);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        // Select all rows in range
        const newSelection = new Set<number>();
        for (let i = minIndex; i <= maxIndex; i++) {
          newSelection.add(visibleRows[i].id);
        }
        
        setSelectedRows(newSelection);
        console.log('📋 Row selection extended:', Array.from(newSelection));
      }
    }
  }, [isDraggingRows, rowDragStart, visibleRows, setSelectedRows]);

  const handleRowDragEnd = useCallback(() => {
    if (isDraggingRows) {
      console.log('📋 Row drag-to-select ended:', Array.from(selectedRows));
      setIsDraggingRows(false);
      setRowDragStart(null);
      
      // Reset cursor and user selection
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isDraggingRows, selectedRows]);

  // Clear cell selection when clicking outside
  const handleClearCellSelection = useCallback(() => {
    if (!isSelectingCells) {
      setSelectedRange(null);
    }
  }, [isSelectingCells]);

  // Copy & Paste functionality
  const handleCopy = useCallback(async (isCut = false) => {
    if (!selectedRange && selectedRows.size === 0 && selectedColumns.size === 0) {
      console.log('🔄 No range, rows, or columns selected for copy');
      return;
    }

    try {
      // 🔍 DEBUG: Extensive column mapping diagnostics
      console.log('🔍 COPY DIAGNOSTICS - Initial State:', {
        selectedRange,
        selectedRows: Array.from(selectedRows),
        selectedColumns: Array.from(selectedColumns),
        isCut,
        visibleColumnsCount: visibleColumns.length,
        visibleColumnsDetails: visibleColumns.map((col, idx) => ({
          arrayIndex: idx,
          columnId: col.id,
          position: col.position,
          name: col.name
        }))
      });
      
      console.log('📋 Starting copy operation:', { selectedRange, selectedRows: Array.from(selectedRows), selectedColumns: Array.from(selectedColumns), isCut });
      
      const data: Array<Array<{ value: any; formula?: string }>> = [];
      let actualStartRow: number, actualEndRow: number, actualStartCol: number, actualEndCol: number;
      
      if (selectedColumns.size > 0) {
        // Column selection - get ALL rows for selected columns using visual indices
        const selectedColumnIds = Array.from(selectedColumns);
        const columnIndices = selectedColumnIds
          .map(colId => visibleColumns.findIndex(c => c.id === colId))
          .filter(idx => idx !== -1)
          .sort((a, b) => a - b);
        
        // 🔍 DEBUG: Column selection mapping diagnostics
        console.log('🔍 COLUMN COPY DIAGNOSTICS:', {
          selectedColumnIds,
          columnIndices,
          columnDetails: selectedColumnIds.map(colId => {
            const col = visibleColumns.find(c => c.id === colId);
            const idx = visibleColumns.findIndex(c => c.id === colId);
            return {
              columnId: colId,
              columnName: col?.name,
              arrayIndex: idx,
              position: col?.position,
              found: !!col
            };
          }),
          visibleColumnsAtIndices: columnIndices.map(idx => ({
            index: idx,
            column: visibleColumns[idx] ? {
              id: visibleColumns[idx].id,
              name: visibleColumns[idx].name,
              position: visibleColumns[idx].position
            } : 'INVALID_INDEX'
          }))
        });
        
        actualStartRow = 1;
        actualEndRow = visibleRows.length;
        // 🔧 FIXED: Use actual array indices, not position-based values
        actualStartCol = Math.min(...columnIndices);
        actualEndCol = Math.max(...columnIndices);
        
        // 🔧 FIXED: Use visual column indices instead of column.position
        for (let visualRow = actualStartRow; visualRow <= actualEndRow; visualRow++) {
          const rowData: Array<{ value: any; formula?: string }> = [];
          
          for (const colIndex of columnIndices) {
            const column = visibleColumns[colIndex];
            if (column) {
              // Convert visual row position to actual rowId
              const rowId = visibleRows[visualRow - 1]?.id;
              const cell = rowId ? getCellValue(rowId, column.id) : undefined;
              rowData.push({
                value: cell?.value || '',
                formula: cell?.formula
              });
              
              // 🔍 DEBUG: Sample data collection for first few rows
              if (visualRow <= 3) {
                console.log(`🔍 COPY ROW ${visualRow} COL ${colIndex}:`, {
                  columnName: column.name,
                  rowId,
                  cellValue: cell?.value,
                  cellFormula: cell?.formula
                });
              }
            }
          }
          data.push(rowData);
        }
        
        console.log('📋 Column selection - visual indices:', { columnIndices, rowCount: actualEndRow - actualStartRow + 1 });
        
      } else if (selectedRows.size > 0 && !selectedRange) {
        // 🐛 FIXED: Row selection - use visual column indices
        const rowIds = Array.from(selectedRows).sort((a, b) => a - b);
        actualStartCol = 1; // First visual column
        actualEndCol = visibleColumns.length; // Last visual column
        
        // Collect data ONLY for actually selected rows using all visible columns
        for (const rowId of rowIds) {
          const rowData: Array<{ value: any; formula?: string }> = [];
          
          for (let colIndex = 0; colIndex < visibleColumns.length; colIndex++) {
            const column = visibleColumns[colIndex];
            const cell = getCellValue(rowId, column.id);
            rowData.push({
              value: cell?.value || '',
              formula: cell?.formula
            });
          }
          data.push(rowData);
        }
        
        // Set range to encompass only actually selected rows for visual feedback
        actualStartRow = Math.min(...rowIds);
        actualEndRow = Math.max(...rowIds);
        
        console.log('📋 Row selection - visual columns:', { selectedRowIds: rowIds, actualRows: data.length, totalCols: visibleColumns.length });
        
      } else if (selectedRange) {
        // 🔧 FIXED: Cell range selection using visual column indices
        const { startRow, endRow, startCol, endCol } = selectedRange;
        actualStartRow = Math.min(startRow, endRow);
        actualEndRow = Math.max(startRow, endRow);
        
        // 🔧 CRITICAL FIX: Correct column position to array index conversion
        // selectedRange uses column.position (1-based), need to convert to visibleColumns array index (0-based)
        const startColPos = Math.min(startCol, endCol);
        const endColPos = Math.max(startCol, endCol);
        
        // Find actual array indices for these column positions
        const startColIndex = visibleColumns.findIndex(col => col.position === startColPos);
        const endColIndex = visibleColumns.findIndex(col => col.position === endColPos);
        
        // Store the actual array indices
        actualStartCol = startColIndex;
        actualEndCol = endColIndex;
        
        console.log('🔧 COLUMN POSITION FIX:', {
          selectedRangePositions: { startCol, endCol },
          calculatedPositions: { startColPos, endColPos },
          foundArrayIndices: { startColIndex, endColIndex },
          storedRange: { actualStartCol, actualEndCol }
        });
        
        // 🔍 DEBUG: Range copy diagnostics
        console.log('🔍 RANGE COPY DIAGNOSTICS:', {
          selectedRange,
          calculatedRange: {
            actualStartRow, actualEndRow,
            startColIndex, endColIndex,
            actualStartCol, actualEndCol
          },
          affectedColumns: (() => {
            const cols = [];
            for (let i = startColIndex; i <= endColIndex; i++) {
              const col = visibleColumns[i];
              cols.push({
                index: i,
                column: col ? { id: col.id, name: col.name, position: col.position } : 'OUT_OF_BOUNDS'
              });
            }
            return cols;
          })(),
          visibleColumnsCount: visibleColumns.length
        });
        
        // 🔧 FIXED: Use corrected array indices
        if (startColIndex === -1 || endColIndex === -1) {
          console.error('🔧 COLUMN POSITION ERROR: Could not find columns for positions:', { startColPos, endColPos });
          return;
        }
        
        // Collect data from selected range using corrected column indices
        for (let visualRow = actualStartRow; visualRow <= actualEndRow; visualRow++) {
          const rowData: Array<{ value: any; formula?: string }> = [];
          
          for (let colIndex = startColIndex; colIndex <= endColIndex; colIndex++) {
            const column = visibleColumns[colIndex];
            if (column) {
              // Convert visual row position to actual rowId
              const rowId = visibleRows[visualRow - 1]?.id;
              const cell = rowId ? getCellValue(rowId, column.id) : undefined;
              rowData.push({
                value: cell?.value || '',
                formula: cell?.formula
              });
              
              // 🔍 DEBUG: Sample data for first row
              if (visualRow === actualStartRow) {
                console.log(`🔍 RANGE COPY ROW ${visualRow} COL ${colIndex}:`, {
                  columnName: column.name,
                  columnPosition: column.position,
                  arrayIndex: colIndex,
                  rowId,
                  cellValue: cell?.value
                });
              }
            } else {
              console.warn(`🔍 RANGE COPY WARNING: Column index ${colIndex} out of bounds!`);
              rowData.push({ value: '' });
            }
          }
          data.push(rowData);
        }
        
        console.log('📋 Cell range selection - visual indices:', {
          actualStartRow, actualEndRow,
          startColIndex, endColIndex,
          actualStartCol, actualEndCol,
          visibleColumnsCount: visibleColumns.length
        });
      } else {
        console.log('❌ No valid selection found');
        return;
      }
      
      // Store copied data with selection type information
      setCopiedCells({
        data,
        range: { startRow: actualStartRow, startCol: actualStartCol, endRow: actualEndRow, endCol: actualEndCol },
        isCut,
        selectionType: selectedColumns.size > 0 ? 'columns' : (selectedRows.size > 0 ? 'rows' : 'range'),
        selectedRowIds: selectedRows.size > 0 ? Array.from(selectedRows) : undefined,
        selectedColumnIds: selectedColumns.size > 0 ? Array.from(selectedColumns) : undefined
      });
      
      // Create clipboard text (tab-separated values)
      const clipboardText = data
        .map(row => row.map(cell => cell.value?.toString() || '').join('\t'))
        .join('\n');
      
      // Copy to system clipboard
      await navigator.clipboard.writeText(clipboardText);
      
      console.log(`✅ ${isCut ? 'Cut' : 'Copy'} successful:`, {
        dataRows: data.length,
        dataCols: data[0]?.length || 0,
        selectionType: selectedColumns.size > 0 ? 'columns' : (selectedRows.size > 0 ? 'rows' : 'range'),
        clipboardText: clipboardText.substring(0, 100) + '...'
      });
      
    } catch (error) {
      console.error(`❌ ${isCut ? 'Cut' : 'Copy'} failed:`, error);
    }
  }, [selectedRange, selectedRows, selectedColumns, visibleColumns, visibleRows, getCellValue]);

  // Cut functionality
  const handleCut = useCallback(async () => {
    await handleCopy(true);
    console.log('✂️ Cut operation completed - data copied with cut flag');
  }, [handleCopy]);

  // ⚡ PERFORMANCE OPTIMIZED: Aggressive Chunking Strategy with larger sizes
  const CHUNK_STRATEGY = useMemo(() => ({
    tiny: { size: 100, parallel: 2, threshold: 0, delay: 5 },        // 0-200 cells (immediate)
    small: { size: 300, parallel: 3, threshold: 200, delay: 10 },    // 200-800 cells
    medium: { size: 500, parallel: 4, threshold: 800, delay: 15 },   // 800-2500 cells
    large: { size: 750, parallel: 5, threshold: 2500, delay: 20 },   // 2500-7500 cells
    huge: { size: 1000, parallel: 4, threshold: 7500, delay: 25 }    // >7500 cells
  }), []);

  // Enhanced strategy selection with more granular sizing
  const getOptimalStrategy = useCallback((totalCells: number) => {
    if (totalCells <= CHUNK_STRATEGY.small.threshold) return CHUNK_STRATEGY.tiny;
    if (totalCells <= CHUNK_STRATEGY.medium.threshold) return CHUNK_STRATEGY.small;
    if (totalCells <= CHUNK_STRATEGY.large.threshold) return CHUNK_STRATEGY.medium;
    if (totalCells <= CHUNK_STRATEGY.huge.threshold) return CHUNK_STRATEGY.large;
    return CHUNK_STRATEGY.huge;
  }, [CHUNK_STRATEGY]);

  // Create optimized chunks from paste data
  const createOptimalChunks = useCallback((pasteData: string[][], strategy: any, startRowIndex: number, startColIndex: number) => {
    const chunks: Array<{
      cells: Array<{ rowId: number; columnId: number; value: any }>;
      chunkId: string;
    }> = [];
    
    let currentChunk: Array<{ rowId: number; columnId: number; value: any }> = [];
    let chunkIndex = 0;

    for (let rowOffset = 0; rowOffset < pasteData.length; rowOffset++) {
      const targetRowIndex = startRowIndex + rowOffset;
      if (targetRowIndex >= visibleRows.length) break;
      
      const targetRow = visibleRows[targetRowIndex];
      const rowData = pasteData[rowOffset];
      
      for (let colOffset = 0; colOffset < rowData.length; colOffset++) {
        const targetColIndex = startColIndex + colOffset;
        if (targetColIndex >= visibleColumns.length) break;
        
        const targetColumn = visibleColumns[targetColIndex];
        const value = rowData[colOffset];
        
        // Skip computed columns and empty values
        if (targetColumn.isComputed || value === '') continue;
        
        currentChunk.push({
          rowId: targetRow.id,
          columnId: targetColumn.id,
          value: value
        });
        
        // Create new chunk when size limit reached
        if (currentChunk.length >= strategy.size) {
          chunks.push({
            cells: [...currentChunk],
            chunkId: `chunk_${chunkIndex++}_${Date.now()}`
          });
          currentChunk = [];
        }
      }
    }
    
    // Add remaining cells as final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        cells: currentChunk,
        chunkId: `chunk_${chunkIndex}_${Date.now()}`
      });
    }
    
    return chunks;
  }, [visibleRows, visibleColumns]);

  // ⚡ PERFORMANCE OPTIMIZED: Batched optimistic UI updates with reduced logging
  const applyOptimisticUpdates = useCallback((chunks: any[]) => {
    // Batch all cell updates into single Map operation for better performance
    const allCellUpdates = new Map<string, any>();
    
    chunks.forEach(chunk => {
      chunk.cells.forEach((cell: any) => {
        const cellKey = `${cell.rowId}-${cell.columnId}`;
        allCellUpdates.set(cellKey, cell.value);
      });
    });

    setPendingValues(prev => {
      const newMap = new Map(prev);
      // Single batch update instead of nested loops
      allCellUpdates.forEach((value, key) => {
        newMap.set(key, value);
      });
      
      // Reduced logging for performance
      if (process.env.NODE_ENV === 'development') {
        console.log('✨ Optimistic updates:', {
          batchSize: allCellUpdates.size,
          totalPending: newMap.size
        });
      }
      return newMap;
    });
  }, []);

  // ⚡ PERFORMANCE OPTIMIZED: Faster parallel processing with reduced logging
  const processChunksInParallel = useCallback(async (chunks: any[], strategy: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 Processing ${chunks.length} chunks (${strategy.parallel} parallel)`);
    }
    
    const results: Array<{ success: boolean; errors: any[]; chunkId: string }> = [];
    
    // Process chunks in batches with optimized parallel execution
    for (let i = 0; i < chunks.length; i += strategy.parallel) {
      const batch = chunks.slice(i, i + strategy.parallel);
      
      const batchPromises = batch.map(async (chunk, index) => {
        const isLastChunk = i + index === chunks.length - 1;
        
        try {
          const response = await fetch(`/api/tables/${tableId}/cells/bulk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Add auth token from cookies or localStorage
              ...(typeof window !== 'undefined' && document.cookie.includes('auth-token') ? {
                'Cookie': document.cookie
              } : {}),
            },
            credentials: 'include', // Include cookies for authentication
            body: JSON.stringify({
              cells: chunk.cells,
              options: {
                chunkId: chunk.chunkId,
                isLastChunk,
                skipFormulaRecalc: !isLastChunk // Only recalc formulas on last chunk
              }
            }),
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Reduced logging - only in development and for significant chunks
          if (process.env.NODE_ENV === 'development' && chunk.cells.length > 50) {
            console.log(`✅ Chunk processed: ${data.data?.updatedCount || 0} cells`);
          }
          
          return {
            success: data.data?.success || false,
            errors: data.data?.errors || [],
            chunkId: chunk.chunkId,
            performance: data.data?.performance
          };
          
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`❌ Chunk ${chunk.chunkId} failed:`, error);
          }
          return {
            success: false,
            errors: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
            chunkId: chunk.chunkId
          };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            errors: [{ error: result.reason }],
            chunkId: 'unknown'
          });
        }
      });
      
      // Reduced delay for faster processing
      if (i + strategy.parallel < chunks.length && strategy.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.max(5, strategy.delay)));
      }
    }
    
    return results;
  }, [tableId]);

  // Handle partial failures and cleanup
  const handlePartialFailure = useCallback(async (results: any[]) => {
    const failedChunks = results.filter(r => !r.success);
    const successfulChunks = results.filter(r => r.success);
    
    console.warn(`⚠️ Partial failure: ${failedChunks.length}/${results.length} chunks failed`);
    
    // Clear optimistic updates for failed chunks only
    const failedCellKeys = new Set<string>();
    failedChunks.forEach(chunk => {
      if (chunk.errors) {
        chunk.errors.forEach((error: any) => {
          if (error.rowId && error.columnId) {
            failedCellKeys.add(`${error.rowId}-${error.columnId}`);
          }
        });
      }
    });
    
    if (failedCellKeys.size > 0) {
      setPendingValues(prev => {
        const newMap = new Map(prev);
        failedCellKeys.forEach(key => newMap.delete(key));
        return newMap;
      });
    }
    
    // Show error notification
    console.error('❌ Paste errors:', failedChunks.flatMap(c => c.errors));
    
    return {
      successful: successfulChunks.length,
      failed: failedChunks.length,
      errors: failedChunks.flatMap(c => c.errors)
    };
  }, []);

  // 🔧 FIXED: Direct paste handler that bypasses API calls
  const handlePasteFixed = useCallback(async () => {
    console.log('🔧 PASTE FIXED: Starting direct paste operation', {
      focusedCell,
      copiedCells: !!copiedCells,
      timestamp: Date.now()
    });

    if (!focusedCell) {
      console.log('❌ PASTE FIXED: No cell focused for paste');
      return;
    }

    try {
      let pasteData: string[][] = [];
      
      // 1. Try internal copied data first
      if (copiedCells && copiedCells.data.length > 0) {
        console.log('📋 PASTE FIXED: Using internal copied data');
        pasteData = copiedCells.data.map(row =>
          row.map(cell => cell.value?.toString() || '')
        );
      } else {
        // 2. Fallback to clipboard
        console.log('📋 PASTE FIXED: Trying clipboard');
        try {
          const clipboardText = await navigator.clipboard.readText();
          console.log('✅ PASTE FIXED: Clipboard read successful:', clipboardText.substring(0, 50));
          
          pasteData = clipboardText
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => line.split('\t'));
        } catch (clipboardError) {
          console.error('❌ PASTE FIXED: Clipboard access failed:', clipboardError);
          return;
        }
      }
      
      if (pasteData.length === 0) {
        console.log('❌ PASTE FIXED: No data to paste');
        return;
      }
      
      console.log('📋 PASTE FIXED: Processing data:', {
        rows: pasteData.length,
        cols: pasteData[0]?.length || 0
      });
      
      // Find starting position
      const startRowIndex = visibleRows.findIndex(row => row.id === focusedCell.rowId);
      const startColumn = visibleColumns.find(col => col.id === focusedCell.columnId);
      
      if (startRowIndex === -1 || !startColumn) {
        console.error('❌ PASTE FIXED: Invalid paste position');
        return;
      }
      
      const startColIndex = visibleColumns.indexOf(startColumn);
      
      // 🔧 DIRECT CELL UPDATES: Use onCellUpdate directly instead of API calls
      let updatedCells = 0;
      
      for (let rowOffset = 0; rowOffset < pasteData.length; rowOffset++) {
        const targetRowIndex = startRowIndex + rowOffset;
        if (targetRowIndex >= visibleRows.length) break;
        
        const targetRow = visibleRows[targetRowIndex];
        const rowData = pasteData[rowOffset];
        
        for (let colOffset = 0; colOffset < rowData.length; colOffset++) {
          const targetColIndex = startColIndex + colOffset;
          if (targetColIndex >= visibleColumns.length) break;
          
          const targetColumn = visibleColumns[targetColIndex];
          const value = rowData[colOffset];
          
          // Skip computed columns and empty values
          if (targetColumn.isComputed || value === '') continue;
          
          try {
            console.log(`📋 PASTE FIXED: Updating cell ${targetRow.id}-${targetColumn.id} = "${value}"`);
            // 🔧 OPTIMIZED: Use skipDelay for fast paste operations
            await onCellUpdate(targetRow.id, targetColumn.id, value, undefined, { skipDelay: true });
            updatedCells++;
          } catch (error) {
            console.error(`❌ PASTE FIXED: Failed to update cell ${targetRow.id}-${targetColumn.id}:`, error);
          }
        }
      }
      
      console.log(`✅ PASTE FIXED COMPLETE: Updated ${updatedCells} cells`);
      
    } catch (error) {
      console.error('❌ PASTE FIXED: Failed:', error);
    }
  }, [focusedCell, copiedCells, visibleRows, visibleColumns, onCellUpdate]);

  // 🔧 ORIGINAL: Improved paste handler with better error handling
  const handlePaste = useCallback(async () => {
    const startTime = Date.now();
    console.log('🔧 PASTE: Starting paste operation', {
      focusedCell,
      copiedCells: !!copiedCells,
      timestamp: startTime
    });

    if (!focusedCell) {
      console.log('❌ PASTE: No cell focused for paste');
      return;
    }

    try {
      // 🔧 PRIORITY: Use internal copiedCells first, then clipboard
      let pasteData: string[][] = [];
      
      if (copiedCells && copiedCells.data.length > 0) {
        // Use internal copied data (more reliable)
        console.log('📋 PASTE: Using internal copied data', {
          rows: copiedCells.data.length,
          cols: copiedCells.data[0]?.length || 0
        });
        pasteData = copiedCells.data.map(row =>
          row.map(cell => cell.value?.toString() || '')
        );
      } else {
        // Fallback to clipboard
        console.log('📋 PASTE: Attempting clipboard access...');
        try {
          const clipboardText = await navigator.clipboard.readText();
          console.log('✅ PASTE: Clipboard read successful', {
            length: clipboardText.length,
            preview: clipboardText.substring(0, 50) + '...'
          });
          
          pasteData = clipboardText
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => line.split('\t'));
        } catch (clipboardError) {
          console.error('❌ PASTE: Clipboard access failed:', clipboardError);
          return;
        }
      }
      
      if (pasteData.length === 0) {
        console.log('❌ PASTE: No data to paste');
        return;
      }
      
      const totalCells = pasteData.flat().length;
      console.log('📋 PASTE: Processing data', {
        rows: pasteData.length,
        cols: pasteData[0]?.length || 0,
        totalCells
      });
      
      // Find starting position
      const startRowIndex = visibleRows.findIndex(row => row.id === focusedCell.rowId);
      const startColumn = visibleColumns.find(col => col.id === focusedCell.columnId);
      
      if (startRowIndex === -1 || !startColumn) {
        console.error('❌ PASTE: Invalid paste position', {
          startRowIndex,
          startColumn: !!startColumn,
          focusedCell
        });
        return;
      }
      
      const startColIndex = visibleColumns.indexOf(startColumn);
      
      // 🔍 DEBUG: Paste position diagnostics
      console.log('🔍 PASTE DIAGNOSTICS:', {
        focusedCell,
        startRowIndex,
        startColumn: startColumn ? {
          id: startColumn.id,
          name: startColumn.name,
          position: startColumn.position
        } : 'NOT_FOUND',
        startColIndex,
        pasteDataSize: `${pasteData.length} rows x ${pasteData[0]?.length || 0} cols`,
        targetRange: {
          endRow: startRowIndex + pasteData.length - 1,
          endCol: startColIndex + (pasteData[0]?.length || 0) - 1,
          maxAvailableCol: visibleColumns.length - 1
        },
        willOverflow: startColIndex + (pasteData[0]?.length || 0) > visibleColumns.length
      });
      
      // Determine optimal strategy and create chunks
      const strategy = getOptimalStrategy(totalCells);
      const chunks = createOptimalChunks(pasteData, strategy, startRowIndex, startColIndex);
      
      if (process.env.NODE_ENV === 'development') {
        const strategyName = strategy === CHUNK_STRATEGY.tiny ? 'tiny' :
          strategy === CHUNK_STRATEGY.small ? 'small' :
          strategy === CHUNK_STRATEGY.medium ? 'medium' :
          strategy === CHUNK_STRATEGY.large ? 'large' : 'huge';
        
        console.log(`🎯 ${strategyName}: ${totalCells} cells, ${chunks.length} chunks`);
      }
      
      if (chunks.length === 0) return;
      
      // Apply optimistic UI updates immediately (batched for performance)
      applyOptimisticUpdates(chunks);
      
      // Process chunks in parallel
      const results = await processChunksInParallel(chunks, strategy);
      
      // Handle results
      const hasErrors = results.some(r => !r.success);
      
      if (hasErrors) {
        await handlePartialFailure(results);
      } else {
        // 🔧 FIXED: Better success handling and localStorage persistence
          console.log('✅ PASTE: All chunks successful, clearing pending values');
          setPendingValues(new Map());
          
          // 🔧 FORCE localStorage update for paste data
          const tableKey = `table-${tableId}`;
          const currentData = localStorage.getItem(tableKey);
          if (currentData) {
            try {
              const parsed = JSON.parse(currentData);
              console.log('💾 PASTE: Updating localStorage with paste data');
              localStorage.setItem(tableKey, JSON.stringify(parsed));
            } catch (e) {
              console.error('❌ PASTE: localStorage update failed:', e);
            }
          }
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        const cellsPerSecond = Math.round((totalCells / duration) * 1000);
        
        console.log(`✅ PASTE COMPLETE: ${duration}ms, ${cellsPerSecond} cells/sec`, {
          hasErrors,
          totalCells,
          successfulResults: results.filter(r => r.success).length,
          failedResults: results.filter(r => !r.success).length
        });
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Paste failed:', error);
      }
      setPendingValues(new Map());
    }
  }, [focusedCell, visibleRows, visibleColumns, copiedCells, tableId,
      getOptimalStrategy, createOptimalChunks, applyOptimisticUpdates,
      processChunksInParallel, handlePartialFailure, CHUNK_STRATEGY]);


  // Range insertion callback for FormulaBar
  const handleCellRangeSelect = useCallback((range: string) => {
    // Call the formula bar's insert function if available
    if (formulaBarInsertRange) {
      formulaBarInsertRange(range);
    }
  }, [formulaBarInsertRange]);

  // Callback to receive the FormulaBar's insert function
  const handleFormulaBarRangeCallback = useCallback((insertFunction: (range: string) => void) => {
    setFormulaBarInsertRange(() => insertFunction);
  }, []);

  // Delete handlers for cell content
  const handleDeleteCell = useCallback(async (rowId: number, columnId: number) => {
    console.log('🗑️ Deleting cell content:', { rowId, columnId });
    const column = visibleColumns.find(col => col.id === columnId);
    
    // Skip computed columns
    if (column?.isComputed) {
      console.log('🗑️ Skipping computed column');
      return;
    }
    
    try {
      await onCellUpdate(rowId, columnId, ''); // Clear content
      console.log('✅ Cell content deleted');
    } catch (error) {
      console.error('❌ Error deleting cell content:', error);
    }
  }, [visibleColumns, onCellUpdate]);

  const handleDeleteRange = useCallback(async () => {
    if (!selectedRange) return;
    
    console.log('🗑️ Deleting range content:', selectedRange);
    
    const { startRow, endRow, startCol, endCol } = selectedRange;
    const actualStartRow = Math.min(startRow, endRow);
    const actualEndRow = Math.max(startRow, endRow);
    const actualStartCol = Math.min(startCol, endCol);
    const actualEndCol = Math.max(startCol, endCol);
    
    let deletedCount = 0;
    
    // 🔧 FIXED: Convert visual positions back to rowIds for deletion
    for (let visualRow = actualStartRow; visualRow <= actualEndRow; visualRow++) {
      for (let col = actualStartCol; col <= actualEndCol; col++) {
        const column = visibleColumns.find(c => c.position === col);
        if (column && !column.isComputed) {
          // Convert visual row position to actual rowId
          const rowId = visibleRows[visualRow - 1]?.id;
          if (rowId) {
            try {
              await onCellUpdate(rowId, column.id, '');
              deletedCount++;
            } catch (error) {
              console.error(`❌ Error deleting cell [${rowId}, ${column.id}]:`, error);
            }
          }
        }
      }
    }
    
    console.log(`✅ Deleted content from ${deletedCount} cells`);
  }, [selectedRange, visibleColumns, onCellUpdate]);

  const handleDeleteSelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) return;
    
    console.log('🗑️ Deleting content from selected rows:', Array.from(selectedRows));
    
    let deletedCount = 0;
    
    for (const rowId of selectedRows) {
      for (const column of visibleColumns) {
        if (!column.isComputed) {
          try {
            await onCellUpdate(rowId, column.id, '');
            deletedCount++;
          } catch (error) {
            console.error(`❌ Error deleting cell [${rowId}, ${column.id}]:`, error);
          }
        }
      }
    }
    
    console.log(`✅ Deleted content from ${deletedCount} cells`);
  }, [selectedRows, visibleColumns, onCellUpdate]);

  // Delete selected columns content
  const handleDeleteSelectedColumns = useCallback(async () => {
    if (selectedColumns.size === 0) return;
    
    console.log('🗑️ Deleting content from selected columns:', Array.from(selectedColumns));
    
    let deletedCount = 0;
    
    for (const columnId of selectedColumns) {
      const column = visibleColumns.find(col => col.id === columnId);
      if (column && !column.isComputed) {
        for (const row of visibleRows) {
          try {
            await onCellUpdate(row.id, columnId, '');
            deletedCount++;
          } catch (error) {
            console.error(`❌ Error deleting cell [${row.id}, ${columnId}]:`, error);
          }
        }
      }
    }
    
    console.log(`✅ Deleted content from ${deletedCount} cells in columns`);
  }, [selectedColumns, visibleColumns, visibleRows, onCellUpdate]);

  // Cell style helper
  const getCellClassName = useCallback((rowId: number, columnId: number) => {
    const cellKey = getCellKey(rowId, columnId);
    const isHighlighted = highlightedCells.has(cellKey);
    const isDependent = dependentCells.has(cellKey);
    const isFocused = focusedCell?.rowId === rowId && focusedCell?.columnId === columnId;
    const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
    const column = columns.find(col => col.id === columnId);
    const isComputed = column?.isComputed || false;
    
    // Convert rowId to visual position for correct highlighting
    const currentRowVisualPosition = visibleRows.findIndex(r => r.id === rowId) + 1;
    
    // Check if cell is in selected range using visual positions
    const isInSelectedRange = selectedRange && column && currentRowVisualPosition > 0 ? (
      currentRowVisualPosition >= Math.min(selectedRange.startRow, selectedRange.endRow) &&
      currentRowVisualPosition <= Math.max(selectedRange.startRow, selectedRange.endRow) &&
      column.position >= Math.min(selectedRange.startCol, selectedRange.endCol) &&
      column.position <= Math.max(selectedRange.startCol, selectedRange.endCol)
    ) : false;

    // Check if cell is in copied range (for visual feedback) - this uses rowIds directly
    const isInCopiedRange = copiedCells && column ? (
      rowId >= copiedCells.range.startRow &&
      rowId <= copiedCells.range.endRow &&
      column.position >= copiedCells.range.startCol &&
      column.position <= copiedCells.range.endCol
    ) : false;

    // Check if cell is in selected column - Enhanced for drag feedback
    const isInSelectedColumn = selectedColumns.has(columnId);
    
    // Check if cell is in selected row
    const isInSelectedRow = selectedRows.has(rowId);
    
    return cn(
      "px-2 py-1 min-h-[32px] flex items-center relative transition-colors",
      {
        "cursor-pointer": !isComputed,
        "cursor-default bg-gray-100": isComputed,
        "bg-blue-100 ring-2 ring-blue-400": isFocused && !isEditing && !isInSelectedRange && !isInSelectedColumn && !isInSelectedRow,
        "hover:bg-gray-50": !isComputed && !isFocused && !isEditing && !isInSelectedRange && !isInCopiedRange && !isInSelectedColumn && !isInSelectedRow,
        "bg-green-50": isHighlighted && !isInSelectedRange && !isInCopiedRange && !isInSelectedColumn && !isInSelectedRow,
        "bg-orange-50": isDependent && !isInSelectedRange && !isInCopiedRange && !isInSelectedColumn && !isInSelectedRow,
        "bg-white ring-2 ring-blue-500": isEditing && !isComputed,
        "bg-purple-100 ring-1 ring-purple-300": isInSelectedRange && !isEditing,
        "bg-yellow-50 ring-1 ring-yellow-300 ring-dashed": isInCopiedRange && !isInSelectedRange && !isEditing && !copiedCells?.isCut,
        "bg-red-50 ring-1 ring-red-300 ring-dashed": isInCopiedRange && !isInSelectedRange && !isEditing && copiedCells?.isCut,
        // Enhanced column selection with drag feedback
        "bg-blue-50 ring-1 ring-blue-300": isInSelectedColumn && !isEditing && !isInSelectedRange && !isInSelectedRow,
        "bg-blue-100 ring-2 ring-blue-400 shadow-sm": isInSelectedColumn && isDraggingColumns && !isEditing && !isInSelectedRange,
        // Enhanced row selection with drag feedback
        "bg-indigo-50 ring-1 ring-indigo-300": isInSelectedRow && !isEditing && !isInSelectedRange && !isInSelectedColumn,
        "bg-indigo-100 ring-2 ring-indigo-400 shadow-sm": isInSelectedRow && isDraggingRows && !isEditing && !isInSelectedRange,
      }
    );
  }, [focusedCell, editingCell, highlightedCells, dependentCells, getCellKey, columns, selectedRange, copiedCells, selectedColumns, selectedRows, isDraggingColumns, isDraggingRows, visibleRows]);

  // Row selection handlers - fixed for proper individual and multi-selection
  const handleRowSelect = useCallback((rowId: number, mode: 'single' | 'toggle' | 'range' = 'single') => {
    console.log('🖱️ Row selection:', { rowId, mode, currentSelection: Array.from(selectedRows) });
    
    const newSelection = new Set(selectedRows);
    
    if (mode === 'toggle') {
      // Toggle mode - add/remove individual row from selection (checkbox behavior)
      if (newSelection.has(rowId)) {
        newSelection.delete(rowId);
      } else {
        newSelection.add(rowId);
      }
    } else if (mode === 'range' && selectedRows.size > 0) {
      // Range selection - select from last selected to this row
      const allRowIds = visibleRows.map(row => row.id);
      const lastSelected = Array.from(selectedRows)[selectedRows.size - 1];
      const currentIndex = allRowIds.indexOf(rowId);
      const lastIndex = allRowIds.indexOf(lastSelected);
      
      const startIndex = Math.min(currentIndex, lastIndex);
      const endIndex = Math.max(currentIndex, lastIndex);
      
      // Add range to existing selection
      for (let i = startIndex; i <= endIndex; i++) {
        newSelection.add(allRowIds[i]);
      }
    } else {
      // Single select mode - clear all and select only this row
      newSelection.clear();
      newSelection.add(rowId);
    }
    
    console.log('🔄 New selection:', Array.from(newSelection));
    setSelectedRows(newSelection);
  }, [visibleRows, selectedRows, setSelectedRows]);

  const handleSelectAll = useCallback(() => {
    const allSelected = selectedRows.size === visibleRows.length && visibleRows.length > 0;
    
    if (allSelected) {
      // Deselect all rows
      setSelectedRows(new Set());
    } else {
      // Select all visible rows
      const allRowIds = visibleRows.map(row => row.id);
      setSelectedRows(new Set(allRowIds));
    }
  }, [selectedRows, visibleRows, setSelectedRows]);

  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, rowId: number) => {
    setDraggedRow(rowId);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowId.toString());
    
    // Add visual feedback
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedRow(null);
    setDragOverRow(null);
    setIsDragging(false);
    
    // Reset visual feedback
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, rowId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedRow !== rowId) {
      setDragOverRow(rowId);
    }
  }, [draggedRow]);

  const handleDragLeave = useCallback(() => {
    setDragOverRow(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetRowId: number) => {
    e.preventDefault();
    const sourceRowId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    if (sourceRowId === targetRowId) return;

    console.log('🔄 DEBUG: Row drop started', { sourceRowId, targetRowId });

    // Reorder rows
    const newRows = [...rows];
    const sourceIndex = newRows.findIndex(row => row.id === sourceRowId);
    const targetIndex = newRows.findIndex(row => row.id === targetRowId);
    
    console.log('🔄 DEBUG: Row indices', { sourceIndex, targetIndex });
    console.log('🔄 DEBUG: Row order before move', newRows.map((r, i) => ({ index: i, id: r.id })));
    
    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [movedRow] = newRows.splice(sourceIndex, 1);
      newRows.splice(targetIndex, 0, movedRow);
      
      console.log('🔄 DEBUG: Row order after move', newRows.map((r, i) => ({ index: i, id: r.id })));
      console.log('🔄 DEBUG: A1 references after move:', newRows.map((r, i) => ({
        id: r.id,
        visualPos: i + 1,
        a1Ref: getA1Ref(r.id, columns[0]?.id || 1)
      })));
      
      // Update UI immediately
      onRowsUpdate?.(newRows);

      // Update formula engine with new row order via API
      try {
        const newRowOrder = newRows.map(row => row.id);
        console.log('🔄 DEBUG: Sending new row order to API:', newRowOrder);
        
        const response = await fetch(`/api/tables/${tableId}/rows`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rowOrder: newRowOrder,
          }),
        });

        if (!response.ok) {
          console.error('Failed to update row order in formula engine:', response.statusText);
        } else {
          console.log('✅ Formula engine updated with new row order');
        }
      } catch (error) {
        console.error('Error updating formula engine row order:', error);
      }
    }
    
    setDragOverRow(null);
    setDraggedRow(null);
    setIsDragging(false);
  }, [rows, onRowsUpdate, tableId, getA1Ref, columns]);

  // Row styling helper
  const getRowClassName = useCallback((rowId: number) => {
    const isSelected = selectedRows.has(rowId);
    const isDraggedOver = dragOverRow === rowId;
    const isDraggedRow = draggedRow === rowId;
    
    return cn({
      "bg-blue-50 border-l-4 border-l-blue-500": isSelected,
      "bg-green-50 border-t-2 border-green-400": isDraggedOver && !isDraggedRow,
      "opacity-50": isDraggedRow,
    });
  }, [selectedRows, dragOverRow, draggedRow]);

  // Filter handlers
  const handleFilterChange = useCallback((columnId: number, filter: ColumnFilter | null) => {
    setColumnFilters(prev => {
      const newFilters = new Map(prev);
      if (filter) {
        newFilters.set(columnId, filter);
      } else {
        newFilters.delete(columnId);
      }
      return newFilters;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters(new Map());
  }, []);

  // Sorting handlers
  const handleSortColumn = useCallback((columnId: number, direction: 'asc' | 'desc') => {
    setColumnSort({ columnId, direction });
  }, []);

  const clearSort = useCallback(() => {
    setColumnSort(null);
  }, []);

  // Column management handlers
  const handleEditColumn = useCallback((columnId: number) => {
    const column = columns.find(col => col.id === columnId);
    if (column) {
      setEditingColumn({
        columnId: column.id,
        name: column.name,
        type: column.type
      });
    }
  }, [columns]);

  const handleSaveColumnEdit = useCallback(async () => {
    if (!editingColumn || !onColumnUpdate) return;
    
    try {
      await onColumnUpdate(editingColumn.columnId, {
        name: editingColumn.name,
        type: editingColumn.type
      });
      setEditingColumn(null);
    } catch (error) {
      console.error('Error updating column:', error);
    }
  }, [editingColumn, onColumnUpdate]);

  const handleCancelColumnEdit = useCallback(() => {
    setEditingColumn(null);
  }, []);

  const handleInsertColumn = useCallback(async (columnId: number, direction: 'left' | 'right') => {
    if (!onColumnInsert) return;
    
    try {
      await onColumnInsert(columnId, direction);
    } catch (error) {
      console.error('Error inserting column:', error);
    }
  }, [onColumnInsert]);

  const handleDeleteColumn = useCallback(async (columnId: number) => {
    if (!onColumnDelete) return;
    
    try {
      await onColumnDelete(columnId);
    } catch (error) {
      console.error('Error deleting column:', error);
    }
  }, [onColumnDelete]);

  const handleHideColumn = useCallback(async (columnId: number) => {
    if (!onColumnHide) return;
    
    try {
      await onColumnHide(columnId);
    } catch (error) {
      console.error('Error hiding column:', error);
    }
  }, [onColumnHide]);

  const handleShowColumn = useCallback(async (columnId: number) => {
    if (!onColumnUpdate) return;
    
    try {
      await onColumnUpdate(columnId, { isVisible: true });
    } catch (error) {
      console.error('Error showing column:', error);
    }
  }, [onColumnUpdate]);

  const handleToggleColumnVisibility = useCallback(async (columnId: number, isVisible: boolean) => {
    if (!onColumnUpdate) return;
    
    try {
      await onColumnUpdate(columnId, { isVisible });
    } catch (error) {
      console.error('Error toggling column visibility:', error);
    }
  }, [onColumnUpdate]);

  // Add Row handler
  const handleAddRow = useCallback(async () => {
    if (!onRowAdd) return;
    
    try {
      await onRowAdd();
    } catch (error) {
      console.error('Error adding row:', error);
    }
  }, [onRowAdd]);

  // Delete Rows handler
  const handleDeleteRows = useCallback(async (rowIds: number[]) => {
    if (!onRowDelete) return;
    
    try {
      await onRowDelete(rowIds);
      setSelectedRows(new Set());
      setContextMenu(null);
    } catch (error) {
      console.error('Error deleting rows:', error);
    }
  }, [onRowDelete]);

  // Hide Rows handler
  const handleHideRows = useCallback(async (rowIds: number[]) => {
    if (!onRowHide) return;
    
    try {
      await onRowHide(rowIds);
      setSelectedRows(new Set());
      setContextMenu(null);
    } catch (error) {
      console.error('Error hiding rows:', error);
    }
  }, [onRowHide]);

  // Unhide Rows handler
  const handleUnhideRows = useCallback(async (rowIds: number[]) => {
    if (!onRowUnhide) return;
    
    try {
      await onRowUnhide(rowIds);
    } catch (error) {
      console.error('Error unhiding rows:', error);
    }
  }, [onRowUnhide]);

  // CSV Import/Export handlers
  const handleCSVImport = useCallback(() => {
    setShowCSVImportDialog(true);
  }, []);

  const handleCSVExport = useCallback(async (includeFormulas = false) => {
    if (!onCSVExport) return;
    
    try {
      await onCSVExport({ includeFormulas });
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  }, [onCSVExport]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCSVImportFile(file);
      setShowCSVImportDialog(false);
      setShowCSVMappingDialog(true);
    }
  }, []);

  const handleImportConfirm = useCallback(async () => {
    if (!csvImportFile || !onCSVImport) return;
    
    try {
      // Simple import without mapping
      await onCSVImport(csvImportFile);
      setShowCSVImportDialog(false);
      setCSVImportFile(null);
      setCSVImportData(null);
    } catch (error) {
      console.error('Error importing CSV:', error);
    }
  }, [csvImportFile, onCSVImport]);

  const handleMappingConfirm = useCallback(async (mappings: any[], createMissingColumns: boolean) => {
    if (!csvImportFile || !onCSVImport) return;
    
    try {
      // Import with column mappings
      await onCSVImport(csvImportFile, { mappings, createMissingColumns });
      setShowCSVMappingDialog(false);
      setCSVImportFile(null);
      setCSVImportData(null);
    } catch (error) {
      console.error('Error importing CSV with mappings:', error);
    }
  }, [csvImportFile, onCSVImport]);

  const handleMappingCancel = useCallback(() => {
    setShowCSVMappingDialog(false);
    setCSVImportFile(null);
    setCSVImportData(null);
  }, []);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setCellContextMenu(null);
      setColumnContextMenu(null);
    };

    if (contextMenu || cellContextMenu || columnContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu, cellContextMenu, columnContextMenu]);

  // 🔧 FIXED: Improved keyboard event handlers for Copy & Paste
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tableContainer = document.querySelector('[data-table-container]');
      const isTableFocused = tableContainer && (
        tableContainer.contains(document.activeElement) ||
        focusedCell ||
        selectedRange ||
        selectedRows.size > 0
      );

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

      console.log('⌨️ Key event:', {
        key: event.key,
        ctrlKey,
        focusedCell: !!focusedCell,
        selectedRange: !!selectedRange,
        selectedRows: selectedRows.size
      });

      // Only handle if table is focused
      if (!isTableFocused && !focusedCell && selectedRows.size === 0 && selectedColumns.size === 0) {
        return;
      }

      // 🔧 FIXED: Copy (Ctrl+C / Cmd+C) - Always try to copy something
      if (ctrlKey && event.key.toLowerCase() === 'c') {
        console.log('📋 COPY shortcut - checking what to copy');
        event.preventDefault();
        
        if (selectedRange) {
          console.log('📋 Copying selected range');
          handleCopy();
        }
        else if (selectedColumns.size > 0) {
          console.log('📋 Copying selected columns');
          handleCopy();
        }
        else if (selectedRows.size > 0) {
          console.log('📋 Copying selected rows');
          handleCopy();
        }
        else if (focusedCell) {
          console.log('📋 FIXED: Copying single focused cell directly');
          // 🔧 DIRECT single cell copy without range creation
          const cell = getCellValue(focusedCell.rowId, focusedCell.columnId);
          const cellData = [[{
            value: cell?.value?.toString() || '',
            formula: cell?.formula
          }]];
          
          setCopiedCells({
            data: cellData,
            range: { startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
            isCut: false,
            selectionType: 'range'
          });
          
          // Copy to clipboard
          try {
            navigator.clipboard.writeText(cell?.value?.toString() || '');
            console.log('✅ Single cell copied:', cell?.value);
          } catch (error) {
            console.error('❌ Clipboard copy failed:', error);
          }
        }
        else {
          console.log('📋 Nothing to copy');
        }
      }

      // 🔧 FIXED: Paste (Ctrl+V / Cmd+V) - Use direct cell update
      else if (ctrlKey && event.key.toLowerCase() === 'v') {
        console.log('📋 PASTE shortcut detected!');
        event.preventDefault();
        if (focusedCell) {
          console.log('📋 FIXED: Pasting with direct cell update');
          handlePasteFixed();
        } else {
          console.log('📋 No focused cell for paste');
        }
      }

      // Undo (Ctrl+Z / Cmd+Z)
      else if (ctrlKey && event.key.toLowerCase() === 'z') {
        console.log('🔄 UNDO shortcut detected!');
        event.preventDefault();
        
        if (undoHistory.length > 0) {
          console.log('🔄 Executing undo');
          performUndo();
        } else {
          console.log('🔄 No undo history available');
        }
      }

      // Delete/Backspace to clear cell content
      else if ((event.key === 'Delete' || event.key === 'Backspace')) {
        console.log('🗑️ DELETE shortcut detected!');
        event.preventDefault();
        
        if (selectedRange) {
          handleDeleteRange();
        }
        else if (focusedCell) {
          handleDeleteCell(focusedCell.rowId, focusedCell.columnId);
        }
        else if (selectedRows.size > 0) {
          handleDeleteSelectedRows();
        }
        else if (selectedColumns.size > 0) {
          handleDeleteSelectedColumns();
        }
      }

      // Escape to clear selection
      else if (event.key === 'Escape') {
        setSelectedRange(null);
        setCopiedCells(null);
        setFocusedCell(null);
        setSelectedColumns(new Set());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, selectedRange, selectedRows.size, visibleColumns, handleCopy, handleDeleteRange, handleDeleteCell, handleDeleteSelectedRows]);

  // Clear cell selection when clicking outside the table
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const tableContainer = document.querySelector('[data-table-container]');
      
      if (tableContainer && !tableContainer.contains(target)) {
        handleClearCellSelection();
        // Also clear drag states when clicking outside
        if (isDraggingColumns) {
          handleColumnDragEnd();
        }
        if (isDraggingRows) {
          handleRowDragEnd();
        }
      }
    };

    if (selectedRange && !isSelectingCells) {
      document.addEventListener('click', handleDocumentClick);
      return () => document.removeEventListener('click', handleDocumentClick);
    }
  }, [selectedRange, isSelectingCells, handleClearCellSelection, isDraggingColumns, isDraggingRows]);

  // Column resizing handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = columnWidths.get(columnId) || 150;
    
    // Set cursor and prevent text selection
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(80, startWidth + deltaX);
      
      setColumnWidths(prev => {
        const newMap = new Map(prev);
        newMap.set(columnId, newWidth);
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          const widthsObj = Object.fromEntries(newMap);
          localStorage.setItem(`table-${tableId}-column-widths`, JSON.stringify(widthsObj));
        }
        
        return newMap;
      });
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { passive: false });
  }, [columnWidths, setColumnWidths]);

  // Get column width
  const getColumnWidth = useCallback((columnId: number): number => {
    return columnWidths.get(columnId) || 150; // Default width 150px
  }, [columnWidths]);

  // Cleanup body styles on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Get unique values for select filters
  const getUniqueValues = useCallback((columnId: number) => {
    const values = rows
      .map(row => row.cells.find(cell => cell.columnId === columnId)?.value)
      .filter(value => value != null && value !== '')
      .map(value => value.toString());
    
    return Array.from(new Set(values)).sort();
  }, [rows]);

  // Filter components
  const TextFilter = ({ column }: { column: Column }) => {
    const [operator, setOperator] = useState('contains');
    const [value, setValue] = useState('');
    const currentFilter = columnFilters.get(column.id);

    useEffect(() => {
      if (currentFilter) {
        setOperator(currentFilter.operator);
        setValue(currentFilter.value || '');
      }
    }, [currentFilter]);

    const applyFilter = () => {
      if (value.trim()) {
        handleFilterChange(column.id, {
          columnId: column.id,
          type: 'text',
          operator,
          value: value.trim()
        });
      } else {
        handleFilterChange(column.id, null);
      }
    };

    return (
      <div className="p-3 space-y-3 w-64">
        <Label className="text-xs font-semibold">Filter {column.name}</Label>
        
        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="starts">Starts with</SelectItem>
            <SelectItem value="ends">Ends with</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter value..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8"
          onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
        />

        <div className="flex space-x-2">
          <Button size="sm" onClick={applyFilter} className="flex-1">
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            setValue('');
            handleFilterChange(column.id, null);
          }} className="flex-1">
            Clear
          </Button>
        </div>
      </div>
    );
  };

  const NumberFilter = ({ column }: { column: Column }) => {
    const [operator, setOperator] = useState('equals');
    const [value, setValue] = useState('');
    const [value2, setValue2] = useState('');
    const currentFilter = columnFilters.get(column.id);

    useEffect(() => {
      if (currentFilter) {
        setOperator(currentFilter.operator);
        setValue(currentFilter.value || '');
        setValue2(currentFilter.value2 || '');
      }
    }, [currentFilter]);

    const applyFilter = () => {
      if (value.trim()) {
        handleFilterChange(column.id, {
          columnId: column.id,
          type: 'number',
          operator,
          value: value.trim(),
          value2: operator === 'between' ? value2.trim() : undefined
        });
      } else {
        handleFilterChange(column.id, null);
      }
    };

    return (
      <div className="p-3 space-y-3 w-64">
        <Label className="text-xs font-semibold">Filter {column.name}</Label>
        
        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="greater">Greater than</SelectItem>
            <SelectItem value="less">Less than</SelectItem>
            <SelectItem value="between">Between</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Value..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8"
        />

        {operator === 'between' && (
          <Input
            type="number"
            placeholder="To value..."
            value={value2}
            onChange={(e) => setValue2(e.target.value)}
            className="h-8"
          />
        )}

        <div className="flex space-x-2">
          <Button size="sm" onClick={applyFilter} className="flex-1">
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            setValue('');
            setValue2('');
            handleFilterChange(column.id, null);
          }} className="flex-1">
            Clear
          </Button>
        </div>
      </div>
    );
  };

  const SelectFilter = ({ column }: { column: Column }) => {
    const [selectedValue, setSelectedValue] = useState('');
    const uniqueValues = getUniqueValues(column.id);
    const currentFilter = columnFilters.get(column.id);

    useEffect(() => {
      if (currentFilter) {
        setSelectedValue(currentFilter.value || '');
      }
    }, [currentFilter]);

    const applyFilter = (value: string) => {
      if (value && value !== 'all') {
        handleFilterChange(column.id, {
          columnId: column.id,
          type: 'select',
          operator: 'equals',
          value
        });
        setSelectedValue(value);
      } else {
        handleFilterChange(column.id, null);
        setSelectedValue('');
      }
    };

    return (
      <div className="p-3 space-y-3 w-48">
        <Label className="text-xs font-semibold">Filter {column.name}</Label>
        
        <div className="space-y-1">
          <div
            className="px-2 py-1 text-sm cursor-pointer hover:bg-accent rounded"
            onClick={() => applyFilter('all')}
          >
            <strong>All</strong>
          </div>
          {uniqueValues.map(value => (
            <div
              key={value}
              className={cn(
                "px-2 py-1 text-sm cursor-pointer hover:bg-accent rounded",
                selectedValue === value && "bg-blue-50 text-blue-700"
              )}
              onClick={() => applyFilter(value)}
            >
              {value}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const FilterButton = ({ column }: { column: Column }) => {
    const hasFilter = columnFilters.has(column.id);
    const isCurrentSort = columnSort?.columnId === column.id;
    
    const getFilterComponent = () => {
      switch (column.type) {
        case 'text':
        case 'email':
          return <TextFilter column={column} />;
        case 'number':
          return <NumberFilter column={column} />;
        case 'select':
          return <SelectFilter column={column} />;
        default:
          return <TextFilter column={column} />;
      }
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0 shrink-0",
              (hasFilter || isCurrentSort) && "text-blue-600"
            )}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-h-[500px] overflow-y-auto">
          {/* Filter Section */}
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">
            <Filter className="h-4 w-4 inline mr-2" />
            Filtern nach diesem Feld
          </DropdownMenuLabel>
          <div className="px-2 pb-2">
            {getFilterComponent()}
          </div>
          
          <DropdownMenuSeparator />
          
          {/* Sort Section */}
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">
            Sortierung
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleSortColumn(column.id, 'asc')}
            className="cursor-pointer"
          >
            <SortAsc className="h-4 w-4 mr-2" />
            Aufsteigend sortieren
            {isCurrentSort && columnSort?.direction === 'asc' && (
              <span className="ml-auto text-blue-600">✓</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleSortColumn(column.id, 'desc')}
            className="cursor-pointer"
          >
            <SortDesc className="h-4 w-4 mr-2" />
            Absteigend sortieren
            {isCurrentSort && columnSort?.direction === 'desc' && (
              <span className="ml-auto text-blue-600">✓</span>
            )}
          </DropdownMenuItem>
          {isCurrentSort && (
            <DropdownMenuItem
              onClick={clearSort}
              className="cursor-pointer text-gray-600"
            >
              <X className="h-4 w-4 mr-2" />
              Sortierung entfernen
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          {/* Column Edit Section */}
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">
            Feld bearbeiten
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleEditColumn(column.id)}
            className="cursor-pointer"
          >
            <Edit className="h-4 w-4 mr-2" />
            Name und Typ ändern
          </DropdownMenuItem>
          
          {/* Computed Column Section */}
          {column.isComputed && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">
                Berechnete Spalte
              </DropdownMenuLabel>
              <div className="px-2 pb-2">
                <div className="text-xs text-gray-600 mb-2">
                  Formel: <code className="bg-gray-100 px-1 rounded">{column.formula}</code>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Automatisch berechnet
                </Badge>
              </div>
            </>
          )}
          
          <DropdownMenuSeparator />
          
          {/* Insert Column Section */}
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">
            Neue Spalte einfügen
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleInsertColumn(column.id, 'left')}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Links einfügen
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleInsertColumn(column.id, 'right')}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Rechts einfügen
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Column Management Section */}
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">
            Feld verwalten
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => handleHideColumn(column.id)}
            className="cursor-pointer"
          >
            <EyeOff className="h-4 w-4 mr-2" />
            Feld ausblenden
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleDeleteColumn(column.id)}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Feld löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-0">
        {/* CSV Import/Export Buttons - Hidden file input */}
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
          id="csv-file-input"
        />

        {/* Active Filters Bar */}
        {columnFilters.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md mb-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {columnFilters.size} Filter aktiv
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={clearAllFilters}
              className="text-blue-600 border-blue-600 hover:bg-blue-100"
            >
              Alle löschen
            </Button>
          </div>
        )}

        {/* Tabelle mit integrierter Formel-Leiste */}
        <Card className="rounded-lg overflow-hidden">
          <CardContent className="p-0">
            {/* Integrierte Formel-Leiste */}
            <div className="border-b border-gray-300 bg-gray-50">
              <FormulaBar
                focusedCell={focusedCell}
                columns={columns}
                onFormulaSubmit={handleFormulaSubmit}
                onFormulaCancel={handleFormulaCancel}
                onRegisterRangeInserter={handleFormulaBarRangeCallback}
              />
            </div>
            
            <div className="overflow-x-auto relative" data-table-container>
              <Table className="border-collapse w-full">
                <TableHeader>
                  <TableRow className="border-b border-gray-300">
                    {/* ID Column with improved multi-selection */}
                    <TableHead className="w-12 group relative border-r border-gray-300 bg-gray-50">
                      <div className="flex items-center justify-center">
                        <span className={cn(
                          "text-sm font-medium transition-opacity",
                          selectedRows.size > 0 ? "opacity-0" : "group-hover:opacity-0"
                        )}>#</span>
                        <SelectAllCheckbox
                          checked={selectedRows.size === visibleRows.length && visibleRows.length > 0}
                          indeterminate={selectedRows.size > 0 && selectedRows.size < visibleRows.length}
                          onChange={handleSelectAll}
                          className={cn(
                            "rounded transition-opacity",
                            selectedRows.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}
                          title={selectedRows.size > 0 ? `${selectedRows.size} Zeilen ausgewählt` : "Alle Zeilen auswählen"}
                        />
                      </div>
                    </TableHead>
                    
                    {visibleColumns.map((column, index) => (
                      <TableHead
                        key={column.id}
                        className={cn(
                          "font-semibold border-r border-gray-300 relative group bg-gray-50 transition-colors",
                          selectedColumns.has(column.id) && "bg-blue-100 border-blue-300",
                          isDraggingColumns && selectedColumns.has(column.id) && "bg-blue-200 shadow-lg ring-2 ring-blue-400"
                        )}
                        style={{
                          width: `${getColumnWidth(column.id)}px`,
                          minWidth: '80px',
                          maxWidth: `${getColumnWidth(column.id)}px`,
                          cursor: isDraggingColumns ? 'grabbing' : 'default'
                        }}
                      >
                        <div className="flex items-center justify-between pr-2 relative">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                             <span
                               className={cn(
                                 "truncate font-medium cursor-pointer hover:text-blue-600 transition-colors select-none",
                                 selectedColumns.has(column.id) && "text-blue-600 font-semibold"
                               )}
                               onClick={(e) => {
                                 // Only handle click if not dragging
                                 if (!isDraggingColumns) {
                                   e.stopPropagation();
                                   if (e.shiftKey && selectedColumns.size > 0) {
                                     handleColumnSelect(column.id, 'range');
                                   } else if (e.ctrlKey || e.metaKey) {
                                     handleColumnSelect(column.id, 'toggle');
                                   } else {
                                     handleColumnSelect(column.id, 'single');
                                   }
                                 }
                               }}
                               onMouseDown={(e) => {
                                 // Start drag-to-select on mouse down (but not on modifier keys)
                                 if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                   handleColumnDragStart(column.id, e);
                                 }
                               }}
                               onMouseEnter={() => {
                                 // Extend selection ONLY when actively dragging
                                 if (isDraggingColumns) {
                                   handleColumnDragEnter(column.id);
                                 }
                               }}
                               onMouseUp={handleColumnDragEnd}
                               onDoubleClick={(e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 handleEditColumn(column.id);
                               }}
                               onContextMenu={(e) => handleColumnContextMenu(e, column.id)}
                               title={`Klick und ziehen für Mehrfachauswahl, Doppelklick zum Bearbeiten von "${column.name}"`}
                             >
                               {column.name}
                             </span>
                             {columnFilters.has(column.id) && (
                               <div className="h-2 w-2 bg-blue-500 rounded-full shrink-0" />
                             )}
                             {columnSort?.columnId === column.id && (
                               <div className="flex items-center">
                                 {columnSort.direction === 'asc' ? (
                                   <SortAsc className="h-3 w-3 text-blue-600" />
                                 ) : (
                                   <SortDesc className="h-3 w-3 text-blue-600" />
                                 )}
                               </div>
                             )}
                           </div>
                           
                           <div className="flex items-center space-x-1">
                             <FilterButton column={column} />
                           </div>
                         </div>
                         
                         {/* Resize handle on the right edge */}
                         <div
                           className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-200 transition-colors opacity-0 hover:opacity-100"
                           onMouseDown={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             handleResizeStart(e, column.id);
                           }}
                           title={`Spaltenbreite für ${column.name} ändern`}
                         />
                      </TableHead>
                    ))}
                    
                    {/* Column Management, Add Column, and Undo Buttons */}
                    <TableHead className="w-40 border-r border-gray-300 bg-gray-50">
                      <div className="flex items-center justify-center space-x-1">
                        {/* UNDO BUTTON - Clean Production Version */}
                        <button
                          onClick={() => {
                            console.log('🔄 UNDO BUTTON CLICKED!', {
                              historyLength: undoHistory.length,
                              canUndo
                            });
                            
                            if (undoHistory.length > 0) {
                              console.log('🔄 Performing undo operation');
                              performUndo();
                            } else {
                              console.log('⚠️ No undo history available');
                            }
                          }}
                          className={`h-8 w-8 p-0 border-2 rounded cursor-pointer flex items-center justify-center transition-colors ${
                            canUndo
                              ? 'text-white bg-blue-600 hover:bg-blue-700 border-blue-800'
                              : 'text-white bg-gray-400 hover:bg-gray-500 border-gray-600 cursor-not-allowed'
                          }`}
                          title={canUndo ? "Rückgängig machen (Cmd+Z)" : "Keine Aktionen zum Rückgängig machen"}
                          disabled={!canUndo}
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                        
                        {/* History Counter Badge */}
                        {undoHistory.length > 0 && (
                          <span className="text-xs text-blue-600 font-mono">
                            {undoHistory.length}
                          </span>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowColumnManager(true)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Spalten verwalten"
                        >
                          <Columns className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onColumnInsert?.(visibleColumns[visibleColumns.length - 1]?.id || 0, 'right')}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Neue Spalte hinzufügen"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row, index) => {
                    // Check if there's a hidden group after this row
                    const hiddenGroupAfterThis = hiddenRowGroups.find(group => group.afterRowId === row.id);
                    
                    return (
                      <React.Fragment key={`row-fragment-${row.id}`}>
                    <TableRow
                      key={`table-row-${row.id}`}
                      className={cn(
                        getRowClassName(row.id),
                        "border-b border-gray-200 transition-colors",
                        isDraggingRows && selectedRows.has(row.id) && "bg-blue-100 shadow-lg ring-2 ring-blue-400"
                      )}
                      style={{
                        cursor: isDraggingRows ? 'grabbing' : 'default'
                      }}
                      onClick={(e) => {
                        // Zeilen-Auswahl nur durch explizite Row-Area Klicks (nicht durch Zell-Klicks)
                        e.preventDefault();
                        console.log('🖱️ Row click (should only happen via row area, not cell):', { rowId: row.id });
                        
                        if (e.shiftKey && selectedRows.size > 0) {
                          handleRowSelect(row.id, 'range');
                        } else if (e.ctrlKey || e.metaKey) {
                          handleRowSelect(row.id, 'toggle');
                        } else {
                          handleRowSelect(row.id, 'single');
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const rowIds = selectedRows.has(row.id) ? Array.from(selectedRows) : [row.id];
                        if (!selectedRows.has(row.id)) {
                          handleRowSelect(row.id, 'single');
                        }
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          rowIds: rowIds
                        });
                      }}
                    >
                      {/* ID Cell with fixed row numbers */}
                      <TableCell
                        className={cn(
                          "w-12 p-0 group border-r border-gray-300 transition-colors",
                          selectedRows.has(row.id) && "bg-blue-50 border-blue-300",
                          isDraggingRows && selectedRows.has(row.id) && "bg-blue-200"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className="flex items-center justify-center relative px-2 py-1"
                          style={{
                            minHeight: '32px',
                            cursor: isDraggingRows ? 'grabbing' : 'default'
                          }}
                        >
                          <span className={cn(
                            "text-sm text-gray-600 font-mono transition-opacity cursor-pointer absolute inset-0 flex items-center justify-center select-none",
                            selectedRows.has(row.id) ? "opacity-0" : "group-hover:opacity-0",
                            selectedRows.has(row.id) && "text-blue-600 font-semibold"
                          )}
                          onClick={(e) => {
                            // Only handle click if not dragging
                            if (!isDraggingRows) {
                              e.stopPropagation();
                              handleRowSelect(row.id, 'toggle'); // Click number = toggle for multi-select
                            }
                          }}
                          onMouseDown={(e) => {
                            console.log('🖱️ Row mouseDown triggered:', { rowId: row.id });
                            // Start row drag-to-select on mouse down (but not on modifier keys)
                            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRowDragStart(row.id, e);
                            }
                          }}
                          onMouseEnter={() => {
                            // Extend row selection ONLY when dragging
                            if (isDraggingRows) {
                              handleRowDragEnter(row.id);
                            }
                          }}
                          onMouseUp={handleRowDragEnd}
                          title={`Zeile ${index + 1} - Klick und ziehen für Mehrfachauswahl`}>
                            {index + 1}
                          </span>
                          <div className={cn(
                            "flex items-center space-x-2 transition-opacity absolute inset-0 justify-center",
                            selectedRows.has(row.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            <input
                              type="checkbox"
                              checked={selectedRows.has(row.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleRowSelect(row.id, 'toggle'); // Checkbox = toggle mode
                              }}
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                              }}
                              className="rounded cursor-pointer"
                            />
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                handleDragStart(e, row.id);
                              }}
                              onDragEnd={(e) => {
                                e.stopPropagation();
                                handleDragEnd(e);
                              }}
                              onDragOver={(e) => {
                                e.stopPropagation();
                                handleDragOver(e, row.id);
                              }}
                              onDragLeave={(e) => {
                                e.stopPropagation();
                                handleDragLeave();
                              }}
                              onDrop={(e) => {
                                e.stopPropagation();
                                handleDrop(e, row.id);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      {visibleColumns.map((column) => {
                        const cell = getCellValue(row.id, column.id);
                        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;
                        
                        return (
                          <TableCell
                            key={`${row.id}-${column.id}`}
                            className="p-0 overflow-hidden border-r border-gray-300"
                            style={{
                              width: `${getColumnWidth(column.id)}px`,
                              minWidth: '80px',
                              maxWidth: `${getColumnWidth(column.id)}px`
                            }}
                          >
                            {isEditing ? (
                              <Input
                                value={editValue}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  console.log('📝 Inline editor changed:', newValue);
                                  setEditValue(newValue);
                                  
                                  // 🔧 BUGFIX: Update focusedCell value in real-time for FormulaBar sync
                                  if (focusedCell && focusedCell.rowId === row.id && focusedCell.columnId === column.id) {
                                    setFocusedCell(prev => prev ? {
                                      ...prev,
                                      value: newValue
                                    } : null);
                                  }
                                }}
                                className="h-8 rounded-none border-0 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEdit();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleCancelEdit();
                                  }
                                }}
                                onBlur={() => {
                                  // Small delay to prevent conflicts
                                  setTimeout(handleSaveEdit, 100);
                                }}
                              />
                            ) : (
                              <div
                                className={getCellClassName(row.id, column.id)}
                                onClick={(e) => {
                                  // WICHTIG: Event-Bubbling stoppen, damit Row-Click nicht ausgelöst wird
                                  e.stopPropagation();
                                  console.log('🖱️ Cell click (isolated):', { rowId: row.id, columnId: column.id });
                                  
                                  // Enhanced cell selection with Ctrl/Shift support
                                  if (e.shiftKey && lastSelectedCell) {
                                    // Shift+Click: Extend selection from last selected cell to this cell
                                    const currentColumn = visibleColumns.find(col => col.id === column.id);
                                    const lastColumn = visibleColumns.find(col => col.id === lastSelectedCell.columnId);
                                    
                                    if (currentColumn && lastColumn) {
                                      // 🔧 ENHANCED DEBUG: Use visual positions instead of rowId for range selection
                                      const currentRowVisualPosition = visibleRows.findIndex(r => r.id === row.id) + 1;
                                      const lastRowVisualPosition = visibleRows.findIndex(r => r.id === lastSelectedCell.rowId) + 1;
                                      
                                      // Calculate range using visual positions
                                      const startRow = Math.min(currentRowVisualPosition, lastRowVisualPosition);
                                      const endRow = Math.max(currentRowVisualPosition, lastRowVisualPosition);
                                      const startCol = Math.min(currentColumn.position, lastColumn.position);
                                      const endCol = Math.max(currentColumn.position, lastColumn.position);
                                      
                                      console.log('🎯 ENHANCED DEBUG: Shift+Click Range Selection', {
                                        currentCell: {
                                          rowId: row.id,
                                          visualPos: currentRowVisualPosition,
                                          columnId: column.id,
                                          position: currentColumn.position
                                        },
                                        lastSelectedCell: {
                                          rowId: lastSelectedCell.rowId,
                                          visualPos: lastRowVisualPosition,
                                          columnId: lastSelectedCell.columnId,
                                          position: lastColumn.position
                                        },
                                        calculatedRange: { startRow, endRow, startCol, endCol },
                                        visibleRowsOrder: visibleRows.map((r, i) => ({ visualPos: i + 1, id: r.id })),
                                        expectedSelection: `Should highlight visual rows ${startRow} to ${endRow}`
                                      });
                                      
                                      setSelectedRange({
                                        startRow,
                                        startCol,
                                        endRow,
                                        endCol
                                      });
                                      
                                      // Clear other selections
                                      setSelectedRows(new Set());
                                      setSelectedColumns(new Set());
                                      setFocusedCell(null);
                                      
                                      console.log('🎯 Range extended via Shift+Click:', { startRow, startCol, endRow, endCol });
                                    }
                                  } else if (e.ctrlKey || e.metaKey) {
                                    // Ctrl+Click: Add to selection or start multi-selection
                                    handleCellFocus(row.id, column.id);
                                    setLastSelectedCell({ rowId: row.id, columnId: column.id });
                                  } else {
                                    // Regular cell click
                                    console.log('🧹 Clearing copied cells visual feedback');
                                    setCopiedCells(null);
                                    // Only clear selectedRange if we're starting a new single-cell focus
                                    // Don't clear during multi-cell selection process
                                    if (!isSelectingCells) {
                                      setSelectedRange(null);
                                      setSelectedRows(new Set());
                                      setSelectedColumns(new Set());
                                    }
                                    
                                    // Only focus if not currently editing
                                    if (!editingCell && !editingSelectCell) {
                                      handleCellFocus(row.id, column.id);
                                      setLastSelectedCell({ rowId: row.id, columnId: column.id });
                                    }
                                  }
                                }}
                                onDoubleClick={() => {
                                  // Don't allow editing computed columns
                                  if (!column.isComputed) {
                                    handleCellEdit(row.id, column.id, cell?.formula || cell?.value?.toString() || '');
                                  }
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation(); // Prevent row selection during drag-to-select
                                  handleCellMouseDown(row.id, column.id, e);
                                }}
                                onMouseEnter={() => handleCellMouseEnter(row.id, column.id)}
                                onMouseUp={handleCellMouseUp}
                                onContextMenu={(e) => handleCellContextMenu(e, row.id, column.id)}
                                style={{ minHeight: '32px' }}
                              >
                                <div className="flex items-center justify-between w-full overflow-hidden">
                                  <div className="flex items-center space-x-1 flex-1 overflow-hidden">
                                    {/* fx-Badge for computed columns */}
                                    {column.isComputed && (
                                      <Badge variant="secondary" className="text-xs font-mono px-1 py-0 h-4 shrink-0">
                                        fx
                                      </Badge>
                                    )}
                                    <span className="truncate">
                                    {column.type === 'select' ? (
                                      editingSelectCell?.rowId === row.id && editingSelectCell?.columnId === column.id ? (
                                        // Inline editing mode for select
                                        <Input
                                          value={selectEditValue}
                                          onChange={(e) => {
                                            const newValue = e.target.value;
                                            console.log('📝 Select editor changed:', newValue);
                                            setSelectEditValue(newValue);
                                            
                                            // Sync with formula bar
                                            if (focusedCell && focusedCell.rowId === row.id && focusedCell.columnId === column.id) {
                                              setFocusedCell(prev => prev ? {
                                                ...prev,
                                                value: newValue
                                              } : null);
                                            }
                                          }}
                                          className="h-6 w-full border-0 bg-transparent p-0 text-xs focus:ring-1 focus:ring-blue-500"
                                          placeholder="Neuen Wert eingeben..."
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleSaveSelectEdit();
                                            } else if (e.key === 'Escape') {
                                              e.preventDefault();
                                              handleCancelSelectEdit();
                                            }
                                          }}
                                          onBlur={() => {
                                            // Small delay to prevent conflicts
                                            setTimeout(handleSaveSelectEdit, 100);
                                          }}
                                        />
                                      ) : (
                                        // Normal select dropdown
                                        <Select
                                          value={cell?.value || ''}
                                          onValueChange={(value) => {
                                            console.log('🎨 Select value changed:', { value, rowId: row.id, columnId: column.id });
                                            onCellUpdate(row.id, column.id, value);
                                          }}
                                          disabled={isEditing}
                                        >
                                          <SelectTrigger
                                            className="h-6 w-full border-0 bg-transparent p-0 text-xs hover:bg-accent rounded-md overflow-hidden"
                                            onClick={(e) => {
                                              console.log('🔍 SelectTrigger clicked - preventing row selection');
                                              e.stopPropagation(); // Prevent row selection
                                            }}
                                            onDoubleClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              console.log('✏️ Double-click to edit select value');
                                              handleSelectCellEdit(row.id, column.id, cell?.value?.toString() || '');
                                            }}
                                          >
                                            <Badge
                                              variant={cell?.value ? 'default' : 'secondary'}
                                              className={cn(
                                                "text-xs rounded-md border-0 w-full h-full flex items-center justify-center",
                                                (() => {
                                                  if (!cell?.value) return "bg-gray-100 text-gray-600";
                                                  
                                                  const colorMapping = column.optionColors?.[cell.value];
                                                  
                                                  // Use custom color if defined
                                                  if (colorMapping && typeof colorMapping === 'object') {
                                                    return `${colorMapping.bg} ${colorMapping.text}`;
                                                  }
                                                  
                                                  // Legacy fallback for existing data
                                                  if (cell.value === 'Active') return "bg-green-100 text-green-800";
                                                  if (cell.value === 'Inactive') return "bg-red-100 text-red-800";
                                                  if (cell.value === 'Pending') return "bg-yellow-100 text-yellow-800";
                                                  
                                                  return "bg-gray-100 text-gray-800";
                                                })()
                                              )}
                                            >
                                              {cell?.value || 'Select...'}
                                            </Badge>
                                          </SelectTrigger>
                                          <SelectContent className="rounded-md overflow-hidden">
                                            {(column.options || ['Active', 'Inactive', 'Pending']).map((option) => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                            {/* Add separator and option to add new value */}
                                            <div className="border-t my-1"></div>
                                            <div
                                              className="flex items-center px-2 py-1 text-xs text-blue-600 hover:bg-accent cursor-pointer"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleSelectCellEdit(row.id, column.id, '');
                                              }}
                                            >
                                              <Plus className="h-3 w-3 mr-1" />
                                              Neuen Wert hinzufügen
                                            </div>
                                          </SelectContent>
                                        </Select>
                                      )
                                    ) : (
                                      // Show pending update or actual cell value
                                      (() => {
                                        const cellKey = `${row.id}-${column.id}`;
                                        const pendingValue = pendingValues.get(cellKey);
                                        const actualValue = cell?.value?.toString() || '';
                                        const displayValue = pendingValue !== undefined
                                          ? pendingValue.toString()
                                          : actualValue;
                                        
                                        // Debug log for first cell
                                        if (row.id === 1 && column.id === 2) {
                                          console.log('📱 Cell display logic:', {
                                            cellKey,
                                            pendingValue,
                                            actualValue,
                                            displayValue,
                                            pendingValuesSize: pendingValues.size
                                          });
                                        }
                                        
                                        return displayValue;
                                      })()
                                    )}
                                  </span>
                                 </div>
                                  
                                 <div className="flex items-center space-x-1 shrink-0">
                                   {/* Fehler-Icon */}
                                   {cell?.errorCode && (
                                     <Tooltip>
                                       <TooltipTrigger asChild>
                                         <AlertTriangle className="h-3 w-3 text-destructive" />
                                       </TooltipTrigger>
                                       <TooltipContent>
                                         <div className="max-w-sm">
                                           <div className="font-semibold">Formel-Fehler</div>
                                           <div className="text-xs">{cell.errorCode}</div>
                                         </div>
                                       </TooltipContent>
                                     </Tooltip>
                                   )}
                                   
                                   {/* Formel-Indikator für manuelle Formeln */}
                                   {cell?.formula && !column.isComputed && (
                                     <div className="h-2 w-2 bg-blue-500 rounded-full" />
                                   )}
                                   
                                   {/* Read-only Indikator für computed columns */}
                                   {column.isComputed && (
                                     <Tooltip>
                                       <TooltipTrigger asChild>
                                         <div className="h-2 w-2 bg-gray-400 rounded-full" />
                                       </TooltipTrigger>
                                       <TooltipContent>
                                         <div className="text-xs">
                                           Berechnete Spalte - nur lesbar
                                         </div>
                                       </TooltipContent>
                                     </Tooltip>
                                   )}
                                 </div>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      </TableRow>
                      
                      {/* Render hidden row group indicator after this row if needed */}
                      {hiddenGroupAfterThis && (
                        <TableRow key={`hidden-group-${hiddenGroupAfterThis.startId}-${hiddenGroupAfterThis.endId}`} className="h-1 hover:h-6 transition-all duration-200 group">
                          {/* Small indicator only in the ID column */}
                          <TableCell className="p-0 h-1 group-hover:h-6 transition-all duration-200 w-12 border-r border-gray-300">
                            <div
                              className="w-full h-full flex items-center justify-center cursor-pointer transition-colors"
                              onClick={() => handleUnhideRows(hiddenGroupAfterThis.rowIds)}
                              title={`${hiddenGroupAfterThis.rowIds.length} Zeile${hiddenGroupAfterThis.rowIds.length > 1 ? 'n' : ''} einblenden (klicken)`}
                            >
                              <div className="hidden group-hover:flex items-center space-x-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                <Eye className="h-3 w-3" />
                                <span>
                                  {hiddenGroupAfterThis.rowIds.length > 1
                                    ? `Zeilen #${hiddenGroupAfterThis.startId}-${hiddenGroupAfterThis.endId}`
                                    : `Zeile #${hiddenGroupAfterThis.startId}`
                                  }
                                </span>
                              </div>
                              <div className="group-hover:hidden w-4 h-0.5 bg-gray-400 rounded"></div>
                            </div>
                          </TableCell>
                          
                          {/* Empty cells for other columns */}
                          {visibleColumns.map(col => (
                            <TableCell key={`hidden-cell-${hiddenGroupAfterThis.startId}-${col.id}`} className="p-0 h-1 group-hover:h-6 border-r border-gray-300"></TableCell>
                          ))}
                          <TableCell key={`hidden-cell-${hiddenGroupAfterThis.startId}-actions`} className="p-0 h-1 group-hover:h-6 w-24 border-r border-gray-300"></TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                    );
                  })}

                  {/* Handle hidden groups at the beginning (before any visible rows) */}
                  {hiddenRowGroups.length > 0 && !hiddenRowGroups[0].afterRowId && visibleRows.length > 0 && (
                    <TableRow key={`hidden-group-start-${hiddenRowGroups[0].startId}-${hiddenRowGroups[0].endId}`} className="h-1 hover:h-6 transition-all duration-200 group">
                      <TableCell className="p-0 h-1 group-hover:h-6 transition-all duration-200 w-12 border-r border-gray-300">
                        <div
                          className="w-full h-full flex items-center justify-center cursor-pointer transition-colors"
                          onClick={() => handleUnhideRows(hiddenRowGroups[0].rowIds)}
                          title={`${hiddenRowGroups[0].rowIds.length} Zeile${hiddenRowGroups[0].rowIds.length > 1 ? 'n' : ''} einblenden (klicken)`}
                        >
                          <div className="hidden group-hover:flex items-center space-x-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            <Eye className="h-3 w-3" />
                            <span>
                              {hiddenRowGroups[0].rowIds.length > 1
                                ? `Zeilen #${hiddenRowGroups[0].startId}-${hiddenRowGroups[0].endId}`
                                : `Zeile #${hiddenRowGroups[0].startId}`
                              }
                            </span>
                          </div>
                          <div className="group-hover:hidden w-4 h-0.5 bg-gray-400 rounded"></div>
                        </div>
                      </TableCell>
                      
                      {visibleColumns.map(col => (
                        <TableCell key={col.id} className="p-0 h-1 group-hover:h-6 border-r border-gray-300"></TableCell>
                      ))}
                      <TableCell className="p-0 h-1 group-hover:h-6 w-24 border-r border-gray-300"></TableCell>
                    </TableRow>
                  )}

                  {/* Add Row */}
                  <TableRow key="add-new-row" className="hover:bg-muted/50 border-dashed border-2 border-transparent hover:border-blue-300 border-t border-gray-300">
                    {/* Plus button in ID column */}
                    <TableCell className="w-12 p-0 border-r border-gray-300">
                      <div className="flex items-center justify-center px-2 py-1" style={{ minHeight: '32px' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleAddRow}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    
                    {/* Empty cells for other columns */}
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={`add-row-${column.id}`}
                        className="p-0 text-muted-foreground border-r border-gray-300"
                        style={{
                          width: `${getColumnWidth(column.id)}px`,
                          minWidth: '80px',
                          maxWidth: `${getColumnWidth(column.id)}px`
                        }}
                      >
                        <div className="min-h-[32px] flex items-center text-sm px-2 py-1">
                          {column.position === 2 ? 'Neuen Eintrag hinzufügen...' : ''}
                        </div>
                      </TableCell>
                    ))}
                    
                    {/* Add Column Cell */}
                    <TableCell className="w-24 border-r border-gray-300"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Statistics Bar - Non-sticky version for filters only */}
        {columnFilters.size > 0 && selectedRows.size === 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-blue-700 font-medium">
                {visibleRows.length} von {rows.length} Zeilen (gefiltert)
              </span>
            </div>
          </div>
        )}
        
        {/* Sticky Selection Bar - Only shows when rows are selected */}
        {selectedRows.size > 0 && (
          <div className={cn(
            "fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg transition-all duration-300",
            isSelectionBarMinimized ? "translate-y-[calc(100%-3rem)]" : "translate-y-0"
          )}>
            {/* Minimize/Maximize Handle */}
            <div className="flex items-center justify-center pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelectionBarMinimized(!isSelectionBarMinimized)}
                className="h-6 w-16 p-0 text-gray-400 hover:text-gray-600"
                title={isSelectionBarMinimized ? "Funktionsleiste maximieren" : "Funktionsleiste minimieren"}
              >
                {isSelectionBarMinimized ? (
                  <ChevronDown className="h-4 w-4 rotate-180" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Selection Bar Content */}
            <div className={cn(
              "transition-all duration-300 overflow-hidden",
              isSelectionBarMinimized ? "max-h-0 opacity-0" : "max-h-20 opacity-100"
            )}>
              <div className="flex items-center justify-between p-4 pt-2">
                <div className="flex items-center space-x-4">
                  {/* Selection Count */}
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-blue-700">
                      {selectedRows.size} Zeile{selectedRows.size > 1 ? 'n' : ''} ausgewählt
                    </span>
                  </div>
                  
                  {/* Filter Info */}
                  {columnFilters.size > 0 && (
                    <span className="text-sm text-gray-600 border-l border-gray-300 pl-4">
                      {visibleRows.length} von {rows.length} Zeilen (gefiltert)
                    </span>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteRows(Array.from(selectedRows))}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Löschen ({selectedRows.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleHideRows(Array.from(selectedRows))}
                    className="text-gray-600 border-gray-300 hover:bg-gray-50"
                  >
                    <EyeOff className="h-4 w-4 mr-2" />
                    Ausblenden ({selectedRows.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedRows(new Set())}
                    className="text-gray-500 hover:text-gray-700"
                    title="Auswahl aufheben"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Minimized State Content */}
            {isSelectionBarMinimized && (
              <div className="flex items-center justify-between px-4 pb-3">
                <span className="text-xs text-gray-600">
                  {selectedRows.size} ausgewählt
                </span>
                <div className="flex items-center space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteRows(Array.from(selectedRows))}
                    className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                    title="Löschen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleHideRows(Array.from(selectedRows))}
                    className="h-6 w-6 p-0 text-gray-600 hover:bg-gray-50"
                    title="Ausblenden"
                  >
                    <EyeOff className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedRows(new Set())}
                    className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                    title="Auswahl aufheben"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Bottom padding when selection bar is active to prevent content overlap */}
        {selectedRows.size > 0 && (
          <div className={cn(
            "transition-all duration-300",
            isSelectionBarMinimized ? "h-12" : "h-20"
          )} />
        )}

        {/* Column Edit Dialog */}
        <Dialog open={!!editingColumn} onOpenChange={() => setEditingColumn(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Feld bearbeiten</DialogTitle>
            </DialogHeader>
            {editingColumn && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="column-name">Feldname</Label>
                  <Input
                    id="column-name"
                    value={editingColumn.name}
                    onChange={(e) => setEditingColumn(prev =>
                      prev ? { ...prev, name: e.target.value } : null
                    )}
                    placeholder="Feldname eingeben"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="column-type">Feldtyp</Label>
                  <Select
                    value={editingColumn.type}
                    onValueChange={(value) => setEditingColumn(prev =>
                      prev ? { ...prev, type: value } : null
                    )}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Zahl</SelectItem>
                      <SelectItem value="email">E-Mail</SelectItem>
                      <SelectItem value="select">Auswahl</SelectItem>
                      <SelectItem value="date">Datum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Select Options Management */}
                {editingColumn.type === 'select' && (() => {
                  const currentColumn = columns.find(col => col.id === editingColumn.columnId);
                  
                  // Get current options - use fallback if column options aren't defined yet
                  let currentOptions = currentColumn?.options || [];
                  
                  // If no options defined but column is being used as select, infer from existing data
                  if (currentOptions.length === 0) {
                    const uniqueValues = rows
                      .map(row => row.cells.find(cell => cell.columnId === editingColumn.columnId)?.value)
                      .filter(value => value != null && value !== '' && typeof value === 'string')
                      .map(value => value.toString());
                    
                    currentOptions = Array.from(new Set(uniqueValues));
                    
                    // If still no options, use common defaults
                    if (currentOptions.length === 0) {
                      currentOptions = ['Active', 'Inactive', 'Pending'];
                    }
                  }
                  
                  const currentColors = currentColumn?.optionColors || {};
                  
                  // Predefined color options
                  const colorOptions = [
                    { label: 'Grün', value: 'green', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
                    { label: 'Rot', value: 'red', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
                    { label: 'Gelb', value: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
                    { label: 'Blau', value: 'blue', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
                    { label: 'Lila', value: 'purple', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
                    { label: 'Orange', value: 'orange', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
                    { label: 'Grau', value: 'gray', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
                  ];
                  
                  return (
                    <div className="space-y-2">
                      <Label>Auswahloptionen mit Farben</Label>
                      <div className="space-y-3">
                        {currentOptions.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2 p-2 border rounded-md">
                            <Input
                              value={option}
                              onChange={(e) => {
                                if (e.target.value.trim()) {
                                  const updatedOptions = [...currentOptions];
                                  const oldOption = updatedOptions[index];
                                  updatedOptions[index] = e.target.value.trim();
                                  
                                  // Update colors mapping if option name changed
                                  const updatedColors = { ...currentColors };
                                  if (oldOption !== e.target.value.trim() && updatedColors[oldOption]) {
                                    updatedColors[e.target.value.trim()] = updatedColors[oldOption];
                                    delete updatedColors[oldOption];
                                  }
                                  
                                  onColumnUpdate?.(editingColumn.columnId, {
                                    options: updatedOptions,
                                    optionColors: updatedColors
                                  });
                                }
                              }}
                              className="flex-1"
                              placeholder="Option"
                            />
                            
                            {/* Color Picker */}
                            <Select
                              value={(() => {
                                const storedColor = currentColors[option];
                                if (typeof storedColor === 'object' && storedColor.bg) {
                                  // Find color by bg class
                                  return colorOptions.find(c => c.bg === storedColor.bg)?.value || 'gray';
                                }
                                return typeof storedColor === 'string' ? storedColor : 'gray';
                              })()}
                              onValueChange={(colorValue) => {
                                const selectedColor = colorOptions.find(c => c.value === colorValue);
                                if (selectedColor) {
                                  const updatedColors = { ...currentColors };
                                  updatedColors[option] = {
                                    bg: selectedColor.bg,
                                    text: selectedColor.text
                                  };
                                  onColumnUpdate?.(editingColumn.columnId, { optionColors: updatedColors });
                                }
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <div className="flex items-center space-x-2">
                                  <div className={cn(
                                    "w-4 h-4 rounded",
                                    (() => {
                                      const storedColor = currentColors[option];
                                      if (typeof storedColor === 'object' && storedColor.bg) {
                                        return storedColor.bg;
                                      }
                                      const colorValue = typeof storedColor === 'string' ? storedColor : 'gray';
                                      const fallbackColor = colorOptions.find(c => c.value === colorValue);
                                      return fallbackColor?.bg || 'bg-gray-100';
                                    })()
                                  )} />
                                  <SelectValue placeholder="Farbe" />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {colorOptions.map((color) => (
                                  <SelectItem key={color.value} value={color.value}>
                                    <div className="flex items-center space-x-2">
                                      <div className={cn("w-4 h-4 rounded", color.bg)} />
                                      <span>{color.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {/* Preview Badge */}
                            <Badge
                              className={cn(
                                "text-xs",
                                (() => {
                                  const storedColor = currentColors[option];
                                  if (typeof storedColor === 'object' && storedColor.bg) {
                                    return `${storedColor.bg} ${storedColor.text}`;
                                  }
                                  const colorValue = typeof storedColor === 'string' ? storedColor : 'gray';
                                  const fallbackColor = colorOptions.find(c => c.value === colorValue);
                                  return `${fallbackColor?.bg || 'bg-gray-100'} ${fallbackColor?.text || 'text-gray-800'}`;
                                })()
                              )}
                            >
                              {option}
                            </Badge>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const updatedOptions = currentOptions.filter((_, i) => i !== index);
                                const updatedColors = { ...currentColors };
                                delete updatedColors[option];
                                onColumnUpdate?.(editingColumn.columnId, {
                                  options: updatedOptions,
                                  optionColors: updatedColors
                                });
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        
                        {/* Add new option */}
                        <div className="flex items-center space-x-2 p-2 border border-dashed rounded-md">
                          <Input
                            placeholder="Neue Option hinzufügen..."
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                e.preventDefault();
                                const newOption = e.currentTarget.value.trim();
                                const updatedOptions = [...currentOptions, newOption];
                                const updatedColors = { ...currentColors };
                                updatedColors[newOption] = { bg: 'bg-gray-100', text: 'text-gray-800' }; // Default color
                                onColumnUpdate?.(editingColumn.columnId, {
                                  options: updatedOptions,
                                  optionColors: updatedColors
                                });
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              const input = e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement;
                              if (input?.value.trim()) {
                                const newOption = input.value.trim();
                                const updatedOptions = [...currentOptions, newOption];
                                const updatedColors = { ...currentColors };
                                updatedColors[newOption] = { bg: 'bg-gray-100', text: 'text-gray-800' }; // Default color
                                onColumnUpdate?.(editingColumn.columnId, {
                                  options: updatedOptions,
                                  optionColors: updatedColors
                                });
                                input.value = '';
                              }
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelColumnEdit}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveColumnEdit}>
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Column Manager Dialog */}
        <Dialog open={showColumnManager} onOpenChange={setShowColumnManager}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Columns className="h-5 w-5 mr-2" />
                Spalten verwalten
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Wählen Sie aus, welche Spalten angezeigt werden sollen:
                </div>
                
                {/* All Columns List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {columns.sort((a, b) => a.position - b.position).map((column) => {
                    const isVisible = column.isVisible !== false;
                    return (
                      <div
                        key={column.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent"
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) => handleToggleColumnVisibility(column.id, e.target.checked)}
                            className="rounded"
                          />
                          <div>
                            <div className="font-medium">{column.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {column.type} • Position {column.position}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          {isVisible ? (
                            <Eye className="h-4 w-4 text-green-600" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Actions */}
                <div className="flex space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      columns.forEach(col => {
                        if (col.isVisible === false) {
                          handleToggleColumnVisibility(col.id, true);
                        }
                      });
                    }}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Alle anzeigen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Keep at least ID column visible
                      columns.forEach(col => {
                        if (col.id !== columns[0]?.id) {
                          handleToggleColumnVisibility(col.id, false);
                        }
                      });
                    }}
                    className="flex-1"
                  >
                    <EyeOff className="h-4 w-4 mr-2" />
                    Alle ausblenden
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowColumnManager(false)}>
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Enhanced Context Menu for Rows */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-2 min-w-56"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">
              {contextMenu.rowIds.length} {contextMenu.rowIds.length === 1 ? 'Datensatz' : 'Datensätze'} ausgewählt
            </div>
            
            <div className="py-1">
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => handleDeleteRows(contextMenu.rowIds)}
              >
                <Trash2 className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">
                    {contextMenu.rowIds.length === 1 ? 'Datensatz löschen' : 'Alle ausgewählten Datensätze löschen'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {contextMenu.rowIds.length === 1 ? 'Endgültig entfernen' : `${contextMenu.rowIds.length} Datensätze endgültig entfernen`}
                  </div>
                </div>
              </button>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => handleHideRows(contextMenu.rowIds)}
              >
                <EyeOff className="h-4 w-4 mr-3" />
                <div className="text-left">
                  <div className="font-medium">
                    {contextMenu.rowIds.length === 1 ? 'Datensatz ausblenden' : 'Ausgewählte Datensätze ausblenden'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {contextMenu.rowIds.length === 1 ? 'Temporär verbergen' : `${contextMenu.rowIds.length} Datensätze temporär verbergen`}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* CSV Import Dialog */}
        <Dialog open={showCSVImportDialog} onOpenChange={setShowCSVImportDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                CSV Import
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Wählen Sie eine CSV-Datei aus, um Daten in diese Tabelle zu importieren:
                </div>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label htmlFor="csv-file-input" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          {csvImportFile ? csvImportFile.name : 'CSV-Datei auswählen'}
                        </span>
                      </label>
                      <p className="mt-2 text-xs text-gray-500">
                        Unterstützte Formate: .csv (erste Zeile als Header)
                      </p>
                    </div>
                    <div className="mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('csv-file-input')?.click()}
                      >
                        Datei auswählen
                      </Button>
                    </div>
                  </div>
                </div>

                {csvImportFile && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <FileText className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">
                          Datei bereit zum Import
                        </h3>
                        <div className="mt-2 text-sm text-green-700">
                          <p>Datei: {csvImportFile.name}</p>
                          <p>Größe: {Math.round(csvImportFile.size / 1024)} KB</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCSVImportDialog(false);
                  setCSVImportFile(null);
                  setCSVImportData(null);
                }}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleImportConfirm}
                disabled={!csvImportFile}
              >
                Importieren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CSV Column Mapping Dialog */}
        <CSVColumnMappingDialog
          open={showCSVMappingDialog}
          onOpenChange={setShowCSVMappingDialog}
          csvFile={csvImportFile}
          existingColumns={visibleColumns}
          onConfirm={handleMappingConfirm}
          onCancel={handleMappingCancel}
        />

        {/* Cell Context Menu */}
        {cellContextMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-2 min-w-48"
            style={{
              top: cellContextMenu.y,
              left: cellContextMenu.x,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">
              Zelle bearbeiten
            </div>
            
            <div className="py-1">
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={async () => {
                  // Create temporary range for single cell
                  const column = visibleColumns.find(col => col.id === cellContextMenu.columnId);
                  if (column) {
                    const tempRange = {
                      startRow: cellContextMenu.rowId,
                      endRow: cellContextMenu.rowId,
                      startCol: column.position,
                      endCol: column.position
                    };
                    setSelectedRange(tempRange);
                    setTimeout(() => {
                      handleCopy();
                      setCellContextMenu(null);
                    }, 10);
                  }
                }}
              >
                📋 Kopieren
              </button>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={async () => {
                  // Create temporary range for single cell
                  const column = visibleColumns.find(col => col.id === cellContextMenu.columnId);
                  if (column) {
                    const tempRange = {
                      startRow: cellContextMenu.rowId,
                      endRow: cellContextMenu.rowId,
                      startCol: column.position,
                      endCol: column.position
                    };
                    setSelectedRange(tempRange);
                    setTimeout(() => {
                      handleCut();
                      setCellContextMenu(null);
                    }, 10);
                  }
                }}
              >
                ✂️ Ausschneiden
              </button>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={async () => {
                  if (focusedCell && focusedCell.rowId === cellContextMenu.rowId && focusedCell.columnId === cellContextMenu.columnId) {
                    await handlePaste();
                  }
                  setCellContextMenu(null);
                }}
                disabled={!focusedCell || focusedCell.rowId !== cellContextMenu.rowId || focusedCell.columnId !== cellContextMenu.columnId}
              >
                📄 Einfügen
              </button>
              
              <div className="border-t my-1"></div>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={async () => {
                  await handleDeleteCell(cellContextMenu.rowId, cellContextMenu.columnId);
                  setCellContextMenu(null);
                }}
              >
                🗑️ Inhalt löschen
              </button>
            </div>
          </div>
        )}

        {/* Column Context Menu */}
        {columnContextMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-2 min-w-48"
            style={{
              top: columnContextMenu.y,
              left: columnContextMenu.x,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 bg-gray-50">
              Spalte bearbeiten
            </div>
            
            <div className="py-1">
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={async () => {
                  await handleCopy();
                  setColumnContextMenu(null);
                }}
              >
                📋 Spalte kopieren
              </button>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={async () => {
                  await handleCut();
                  setColumnContextMenu(null);
                }}
              >
                ✂️ Spalte ausschneiden
              </button>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={async () => {
                  await handleDeleteSelectedColumns();
                  setColumnContextMenu(null);
                }}
              >
                🗑️ Spalteninhalt löschen
              </button>
              
              <div className="border-t my-1"></div>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => {
                  handleEditColumn(columnContextMenu.columnId);
                  setColumnContextMenu(null);
                }}
              >
                ✏️ Spalte bearbeiten
              </button>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={async () => {
                  await handleHideColumn(columnContextMenu.columnId);
                  setColumnContextMenu(null);
                }}
              >
                👁️ Spalte ausblenden
              </button>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={async () => {
                  await handleDeleteColumn(columnContextMenu.columnId);
                  setColumnContextMenu(null);
                }}
              >
                🗑️ Spalte löschen
              </button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}