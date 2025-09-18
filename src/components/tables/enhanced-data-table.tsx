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
import { AlertTriangle, Save, X, GripVertical, Filter, ChevronDown, Edit, Plus, SortAsc, SortDesc, Eye, EyeOff, Trash2, Settings, Columns } from 'lucide-react';
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
  onCellUpdate: (rowId: number, columnId: number, value: any, formula?: string) => Promise<void>;
  onRowsUpdate?: (rows: Row[]) => void;
  onRowAdd?: () => Promise<void>;
  onRowDelete?: (rowIds: number[]) => Promise<void>;
  onRowHide?: (rowIds: number[]) => Promise<void>;
  onRowUnhide?: (rowIds: number[]) => Promise<void>;
  onColumnUpdate?: (columnId: number, updates: Partial<Column>) => Promise<void>;
  onColumnInsert?: (afterColumnId: number, direction: 'left' | 'right') => Promise<void>;
  onColumnDelete?: (columnId: number) => Promise<void>;
  onColumnHide?: (columnId: number) => Promise<void>;
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
  onRowUnhide
}: EnhancedDataTableProps) {
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
  const [selectedRange, setSelectedRange] = useState<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null>(null);

  const [highlightedCells, setHighlightedCells] = useState<Set<string>>(new Set());
  const [dependentCells, setDependentCells] = useState<Set<string>>(new Set());
  
  // Row selection and drag & drop
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
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
  
  // Column resizing with localStorage persistence - fix hydration mismatch
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [isColumnWidthsLoaded, setIsColumnWidthsLoaded] = useState(false);

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
    return coordsToA1(rowId, column?.position || 1);
  }, [columns]);

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
  }, [editingCell, editValue, onCellUpdate]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
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

  // Range selection with formula insertion
  const handleCellMouseDown = useCallback((rowId: number, columnId: number, event: React.MouseEvent) => {
    // Only enable range selection if we're editing a formula
    const isEditingFormula = focusedCell && event.shiftKey;
    
    if (isEditingFormula) {
      const column = columns.find(col => col.id === columnId);
      if (column) {
        setSelectedRange({
          startRow: rowId,
          startCol: column.position,
          endRow: rowId,
          endCol: column.position,
        });
      }
    }
  }, [columns, focusedCell]);

  const handleCellMouseEnter = useCallback((rowId: number, columnId: number) => {
    if (selectedRange) {
      const column = columns.find(col => col.id === columnId);
      if (column) {
        setSelectedRange(prev => prev ? {
          ...prev,
          endRow: rowId,
          endCol: column.position,
        } : null);
      }
    }
  }, [selectedRange, columns]);

  const handleCellMouseUp = useCallback(() => {
    if (selectedRange && (
      selectedRange.startRow !== selectedRange.endRow ||
      selectedRange.startCol !== selectedRange.endCol
    )) {
      // Generate range string
      const startA1 = coordsToA1(selectedRange.startRow, selectedRange.startCol);
      const endA1 = coordsToA1(selectedRange.endRow, selectedRange.endCol);
      const rangeString = startA1 === endA1 ? startA1 : `${startA1}:${endA1}`;
      
      // Insert range into current formula via callback
      handleCellRangeSelect(rangeString);
    }
    setSelectedRange(null);
  }, [selectedRange]);

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

  // Cell style helper
  const getCellClassName = useCallback((rowId: number, columnId: number) => {
    const cellKey = getCellKey(rowId, columnId);
    const isHighlighted = highlightedCells.has(cellKey);
    const isDependent = dependentCells.has(cellKey);
    const isFocused = focusedCell?.rowId === rowId && focusedCell?.columnId === columnId;
    const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
    const column = columns.find(col => col.id === columnId);
    const isComputed = column?.isComputed || false;
    
    return cn(
      "rounded px-2 py-1 min-h-[32px] flex items-center relative",
      {
        "cursor-pointer hover:bg-accent": !isComputed,
        "cursor-default bg-gray-50": isComputed,
        "bg-blue-50 border-blue-200 border": isFocused,
        "bg-green-50 border-green-200 border": isHighlighted,
        "bg-orange-50 border-orange-200 border": isDependent,
        "bg-accent": isEditing && !isComputed,
      }
    );
  }, [focusedCell, editingCell, highlightedCells, dependentCells, getCellKey, columns]);

  // Row selection handlers - fixed for proper individual and multi-selection
  const handleRowSelect = useCallback((rowId: number, mode: 'single' | 'toggle' | 'range' = 'single') => {
    console.log('🖱️ Row selection:', { rowId, mode, currentSelection: Array.from(selectedRows) });
    
    setSelectedRows(prev => {
      const newSelection = new Set(prev);
      
      if (mode === 'toggle') {
        // Toggle mode - add/remove individual row from selection (checkbox behavior)
        if (newSelection.has(rowId)) {
          newSelection.delete(rowId);
        } else {
          newSelection.add(rowId);
        }
      } else if (mode === 'range' && prev.size > 0) {
        // Range selection - select from last selected to this row
        const allRowIds = visibleRows.map(row => row.id);
        const lastSelected = Array.from(prev)[prev.size - 1];
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
      return newSelection;
    });
  }, [visibleRows, selectedRows]);

  const handleSelectAll = useCallback(() => {
    if (selectedRows.size === visibleRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(visibleRows.map(row => row.id)));
    }
  }, [selectedRows.size, visibleRows]);

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

  const handleDrop = useCallback((e: React.DragEvent, targetRowId: number) => {
    e.preventDefault();
    const sourceRowId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    
    if (sourceRowId === targetRowId) return;

    // Reorder rows
    const newRows = [...rows];
    const sourceIndex = newRows.findIndex(row => row.id === sourceRowId);
    const targetIndex = newRows.findIndex(row => row.id === targetRowId);
    
    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [movedRow] = newRows.splice(sourceIndex, 1);
      newRows.splice(targetIndex, 0, movedRow);
      
      onRowsUpdate?.(newRows);
    }
    
    setDragOverRow(null);
    setDraggedRow(null);
    setIsDragging(false);
  }, [rows, onRowsUpdate]);

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

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

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
        {/* Formel-Leiste */}
        <FormulaBar
          focusedCell={focusedCell}
          columns={columns}
          onFormulaSubmit={handleFormulaSubmit}
          onFormulaCancel={handleFormulaCancel}
          onRegisterRangeInserter={handleFormulaBarRangeCallback}
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

        {/* Tabelle */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto relative">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* ID Column with improved multi-selection */}
                    <TableHead className="w-12 group relative">
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
                        className="font-semibold border-r border-gray-200 relative"
                        style={{
                          width: `${getColumnWidth(column.id)}px`,
                          minWidth: '80px',
                          maxWidth: `${getColumnWidth(column.id)}px`
                        }}
                      >
                        <div className="flex items-center justify-between pr-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <span className="truncate font-medium">{column.name}</span>
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
                            
                            {/* Professional resize handle */}
                            <button
                              className="w-4 h-4 flex items-center justify-center cursor-col-resize text-gray-400 hover:text-gray-600 transition-colors"
                              onMouseDown={(e) => {
                                console.log('🖱️ Resize handle clicked for column', column.id);
                                e.preventDefault();
                                e.stopPropagation();
                                handleResizeStart(e, column.id);
                              }}
                              title={`Spaltenbreite für ${column.name} ändern`}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="currentColor"
                                className="hover:text-blue-500 transition-colors"
                              >
                                <path d="M2 3h1v6H2V3zM5 3h1v6H8V3zM8 3h1v6H8V3z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </TableHead>
                    ))}
                    
                    {/* Column Management and Add Column Buttons */}
                    <TableHead className="w-24 border-r border-gray-200">
                      <div className="flex items-center justify-center space-x-1">
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
                      <React.Fragment key={row.id}>
                    <TableRow
                      key={row.id}
                      className={getRowClassName(row.id)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, row.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, row.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, row.id)}
                      onClick={(e) => {
                        e.preventDefault();
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
                      <TableCell className="w-12 p-2 group" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center relative">
                          <span className={cn(
                            "text-sm text-gray-600 font-mono transition-opacity cursor-pointer",
                            selectedRows.has(row.id) ? "opacity-0" : "group-hover:opacity-0"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowSelect(row.id, 'toggle'); // Click number = toggle for multi-select
                          }}>
                            {row.id}
                          </span>
                          <div className={cn(
                            "flex items-center space-x-2 transition-opacity",
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
                            <GripVertical
                              className="h-4 w-4 text-gray-400 cursor-grab active:cursor-grabbing"
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      </TableCell>
                      
                      {visibleColumns.map((column) => {
                        const cell = getCellValue(row.id, column.id);
                        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;
                        
                        return (
                          <TableCell
                            key={`${row.id}-${column.id}`}
                            className="p-2 overflow-hidden"
                            style={{
                              width: `${getColumnWidth(column.id)}px`,
                              minWidth: '80px',
                              maxWidth: `${getColumnWidth(column.id)}px`
                            }}
                          >
                            {isEditing ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-8"
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
                                onClick={() => handleCellFocus(row.id, column.id)}
                                onDoubleClick={() => {
                                  // Don't allow editing computed columns
                                  if (!column.isComputed) {
                                    handleCellEdit(row.id, column.id, cell?.formula || cell?.value?.toString() || '');
                                  }
                                }}
                                onMouseDown={(e) => handleCellMouseDown(row.id, column.id, e)}
                                onMouseEnter={() => handleCellMouseEnter(row.id, column.id)}
                                onMouseUp={handleCellMouseUp}
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
                                      <Select
                                        value={cell?.value || ''}
                                        onValueChange={(value) => onCellUpdate(row.id, column.id, value)}
                                        disabled={isEditing}
                                      >
                                        <SelectTrigger
                                          className="h-6 w-full border-0 bg-transparent p-0 text-xs hover:bg-accent"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Badge
                                            variant={cell?.value === 'Active' ? 'default' : 'secondary'}
                                            className="text-xs"
                                          >
                                            {cell?.value || 'Select...'}
                                          </Badge>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Active">Active</SelectItem>
                                          <SelectItem value="Inactive">Inactive</SelectItem>
                                          <SelectItem value="Pending">Pending</SelectItem>
                                        </SelectContent>
                                      </Select>
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
                        <TableRow className="h-1 hover:h-6 transition-all duration-200 group border-b-0">
                          {/* Small indicator only in the ID column */}
                          <TableCell className="p-0 h-1 group-hover:h-6 transition-all duration-200 w-12">
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
                            <TableCell key={col.id} className="p-0 h-1 group-hover:h-6"></TableCell>
                          ))}
                          <TableCell className="p-0 h-1 group-hover:h-6 w-24"></TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                    );
                  })}

                  {/* Handle hidden groups at the beginning (before any visible rows) */}
                  {hiddenRowGroups.length > 0 && !hiddenRowGroups[0].afterRowId && visibleRows.length > 0 && (
                    <TableRow className="h-1 hover:h-6 transition-all duration-200 group border-b-0">
                      <TableCell className="p-0 h-1 group-hover:h-6 transition-all duration-200 w-12">
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
                        <TableCell key={col.id} className="p-0 h-1 group-hover:h-6"></TableCell>
                      ))}
                      <TableCell className="p-0 h-1 group-hover:h-6 w-24"></TableCell>
                    </TableRow>
                  )}

                  {/* Add Row */}
                  <TableRow className="hover:bg-muted/50 border-dashed border-2 border-transparent hover:border-blue-300">
                    {/* Plus button in ID column */}
                    <TableCell className="w-12 p-2">
                      <div className="flex items-center justify-center">
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
                        className="p-2 text-muted-foreground"
                        style={{
                          width: `${getColumnWidth(column.id)}px`,
                          minWidth: '80px',
                          maxWidth: `${getColumnWidth(column.id)}px`
                        }}
                      >
                        <div className="min-h-[32px] flex items-center text-sm">
                          {column.position === 2 ? 'Neuen Eintrag hinzufügen...' : ''}
                        </div>
                      </TableCell>
                    ))}
                    
                    {/* Add Column Cell */}
                    <TableCell className="w-24"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Statistics Bar */}
        {(columnFilters.size > 0 || selectedRows.size > 0) && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center space-x-4 text-sm">
              {columnFilters.size > 0 && (
                <span className="text-blue-700 font-medium">
                  {visibleRows.length} von {rows.length} Zeilen (gefiltert)
                </span>
              )}
              {selectedRows.size > 0 && (
                <span className="text-blue-700 font-semibold">
                  {selectedRows.size} Zeile{selectedRows.size > 1 ? 'n' : ''} ausgewählt
                </span>
              )}
            </div>
            
            {selectedRows.size > 0 && (
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteRows(Array.from(selectedRows))}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Löschen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleHideRows(Array.from(selectedRows))}
                  className="text-gray-600 border-gray-300 hover:bg-gray-50"
                >
                  <EyeOff className="h-4 w-4 mr-1" />
                  Ausblenden
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRows(new Set())}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}


        {/* Column Edit Dialog */}
        <Dialog open={!!editingColumn} onOpenChange={() => setEditingColumn(null)}>
          <DialogContent className="sm:max-w-md">
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
      </div>
    </TooltipProvider>
  );
}