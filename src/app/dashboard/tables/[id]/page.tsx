'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import { EnhancedDataTable, type Column, type Row } from '@/components/tables/enhanced-data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  TableIcon,
  Plus,
  Settings,
  Share2,
  Download,
  Filter,
  Search,
  ArrowUpDown,
  Upload,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

// Mock data with formula examples
const mockTableData = {
  id: 1,
  name: 'Customer Database',
  description: 'Main customer information and contact details',
  folderId: 2,
  folderName: 'Web Apps',
  workspaceId: 1,
  workspaceName: 'My Personal Workspace',
  rowCount: 1247,
  columnCount: 8,
  createdAt: '2024-01-15T09:00:00Z',
  updatedAt: '2024-02-15T10:30:00Z',
};

const initialMockColumns: Column[] = [
  { id: 1, name: 'ID', type: 'number', position: 1, isVisible: true },
  { id: 2, name: 'First Name', type: 'text', position: 2, isVisible: true },
  { id: 3, name: 'Last Name', type: 'text', position: 3, isVisible: true },
  { id: 4, name: 'Email', type: 'email', position: 4, isVisible: true },
  { id: 5, name: 'Phone', type: 'text', position: 5, isVisible: true },
  { id: 6, name: 'Company', type: 'text', position: 6, isVisible: true },
  { id: 7, name: 'Status', type: 'select', position: 7, isVisible: true },
  { id: 8, name: 'Created', type: 'date', position: 8, isVisible: false },
  { id: 9, name: 'Full Name', type: 'text', position: 9, isVisible: true },
  { id: 10, name: 'Total Score', type: 'number', position: 10, isVisible: true },
];

const initialMockRows: Row[] = [
  {
    id: 1,
    cells: [
      { columnId: 1, value: 1 },
      { columnId: 2, value: 'John' },
      { columnId: 3, value: 'Doe' },
      { columnId: 4, value: 'john.doe@example.com' },
      { columnId: 5, value: '+1-555-0123' },
      { columnId: 6, value: 'Acme Corp' },
      { columnId: 7, value: 'Active' },
      { columnId: 8, value: '2024-01-15' },
      { columnId: 9, value: 'John Doe', formula: '=B1&" "&C1' },
      { columnId: 10, value: 95, formula: '=85+10' },
    ]
  },
  {
    id: 2,
    cells: [
      { columnId: 1, value: 2 },
      { columnId: 2, value: 'Jane' },
      { columnId: 3, value: 'Smith' },
      { columnId: 4, value: 'jane.smith@example.com' },
      { columnId: 5, value: '+1-555-0124' },
      { columnId: 6, value: 'Tech Solutions' },
      { columnId: 7, value: 'Inactive' },
      { columnId: 8, value: '2024-01-16' },
      { columnId: 9, value: 'Jane Smith', formula: '=B2&" "&C2' },
      { columnId: 10, value: 87, formula: '=75+12' },
    ]
  },
  {
    id: 3,
    cells: [
      { columnId: 1, value: 3 },
      { columnId: 2, value: 'Bob' },
      { columnId: 3, value: 'Johnson' },
      { columnId: 4, value: 'bob.johnson@example.com' },
      { columnId: 5, value: '+1-555-0125' },
      { columnId: 6, value: 'Design Studio' },
      { columnId: 7, value: 'Pending' },
      { columnId: 8, value: '2024-01-17' },
      { columnId: 9, value: 'Bob Johnson', formula: '=B3&" "&C3' },
      { columnId: 10, value: null, formula: '=AVERAGE(J1:J2)', errorCode: undefined },
    ]
  },
  {
    id: 4,
    cells: [
      { columnId: 1, value: 4 },
      { columnId: 2, value: 'Alice' },
      { columnId: 3, value: 'Brown' },
      { columnId: 4, value: 'alice.brown@example.com' },
      { columnId: 5, value: '+1-555-0126' },
      { columnId: 6, value: 'Marketing Pro' },
      { columnId: 7, value: 'Active' },
      { columnId: 8, value: '2024-01-18' },
      { columnId: 9, value: 'Alice Brown', formula: '=B4&" "&C4' },
      { columnId: 10, value: 182, formula: '=SUM(J1:J2)' },
    ]
  },
];

export default function TableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tableId, setTableId] = useState<number>(1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Handle async params and load data
  useEffect(() => {
    params.then(({ id }) => {
      const parsedId = parseInt(id, 10);
      setTableId(parsedId);
      loadTableData(parsedId);
    });
  }, [params]);

  // Load table data from localStorage or use mock data
  const loadTableData = (id: number) => {
    try {
      const savedRows = localStorage.getItem(`table-${id}-rows`);
      const savedColumns = localStorage.getItem(`table-${id}-columns`);
      
      if (savedRows && savedColumns) {
        setRows(JSON.parse(savedRows));
        setColumns(JSON.parse(savedColumns));
      } else {
        // First time loading - use initial mock data and save it
        setRows(initialMockRows);
        setColumns(initialMockColumns);
        localStorage.setItem(`table-${id}-rows`, JSON.stringify(initialMockRows));
        localStorage.setItem(`table-${id}-columns`, JSON.stringify(initialMockColumns));
      }
    } catch (error) {
      console.error('Error loading table data:', error);
      setRows(initialMockRows);
      setColumns(initialMockColumns);
    } finally {
      setIsLoading(false);
    }
  };

  // Save data to localStorage
  const saveTableData = (newRows: Row[], newColumns: Column[]) => {
    try {
      localStorage.setItem(`table-${tableId}-rows`, JSON.stringify(newRows));
      localStorage.setItem(`table-${tableId}-columns`, JSON.stringify(newColumns));
    } catch (error) {
      console.error('Error saving table data:', error);
    }
  };

  // Calculate formulas after data is loaded
  useEffect(() => {
    if (rows.length > 0) {
      console.log('🧮 Calculating formulas for loaded data...');
      const calculatedRows = recalculateFormulas(rows);
      
      // Only update if formulas actually changed values
      const hasChanges = calculatedRows.some((row, index) =>
        row.cells.some((cell, cellIndex) =>
          cell.value !== rows[index]?.cells[cellIndex]?.value
        )
      );
      
      if (hasChanges) {
        setRows(calculatedRows);
        // Save updated calculations to localStorage
        saveTableData(calculatedRows, columns);
        
        // Debug log
        calculatedRows.forEach(row => {
          row.cells.forEach(cell => {
            if (cell.formula) {
              console.log(`📊 Cell ${row.id}-${cell.columnId}: ${cell.formula} = ${cell.value}`);
            }
          });
        });
      }
    }
  }, [rows.length > 0 && !isLoading]); // Only run when data is loaded

  // Filter rows based on search
  const filteredRows = rows.filter(row =>
    row.cells.some(cell =>
      cell.value?.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Simple formula evaluation for basic functions
  const evaluateFormula = (formula: string, allRows: Row[]): { value: any; error?: string } => {
    try {
      if (!formula.startsWith('=')) return { value: formula };

      const cleanFormula = formula.substring(1).trim();
      
      // Handle AVERAGE function
      const averageMatch = cleanFormula.match(/AVERAGE\(([A-Z]+\d+):([A-Z]+\d+)\)/i);
      if (averageMatch) {
        const [, startCell, endCell] = averageMatch;
        const values = getCellRangeValues(startCell, endCell, allRows);
        const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (numericValues.length === 0) return { value: 0, error: '#VALUE!' };
        const average = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
        return { value: Math.round(average * 100) / 100 }; // Round to 2 decimal places
      }
      
      // Handle SUM function
      const sumMatch = cleanFormula.match(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/i);
      if (sumMatch) {
        const [, startCell, endCell] = sumMatch;
        const values = getCellRangeValues(startCell, endCell, allRows);
        const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        const sum = numericValues.reduce((sum, val) => sum + val, 0);
        return { value: sum };
      }
      
      // Handle simple arithmetic (like =85+10)
      const simpleArithmeticMatch = cleanFormula.match(/^(\d+)\s*([+\-*/])\s*(\d+)$/);
      if (simpleArithmeticMatch) {
        const [, left, operator, right] = simpleArithmeticMatch;
        const leftNum = parseFloat(left);
        const rightNum = parseFloat(right);
        
        switch (operator) {
          case '+': return { value: leftNum + rightNum };
          case '-': return { value: leftNum - rightNum };
          case '*': return { value: leftNum * rightNum };
          case '/': return { value: rightNum !== 0 ? leftNum / rightNum : 0, error: rightNum === 0 ? '#DIV/0!' : undefined };
          default: return { value: 0, error: '#VALUE!' };
        }
      }
      
      // Handle cell concatenation (like =B1&" "&C1)
      const concatMatch = cleanFormula.match(/([A-Z]+\d+)&"([^"]*)"&([A-Z]+\d+)/i);
      if (concatMatch) {
        const [, cell1, separator, cell2] = concatMatch;
        const value1 = getCellValue(cell1, allRows);
        const value2 = getCellValue(cell2, allRows);
        return { value: `${value1}${separator}${value2}` };
      }
      
      return { value: 0, error: '#NAME?' };
    } catch (error) {
      return { value: 0, error: '#VALUE!' };
    }
  };

  // Helper function to get cell value by A1 notation
  const getCellValue = (cellRef: string, allRows: Row[]): any => {
    const match = cellRef.match(/([A-Z]+)(\d+)/);
    if (!match) return 0;
    
    const [, colLetter, rowNumber] = match;
    const rowId = parseInt(rowNumber, 10);
    const colPosition = letterToColumnNumber(colLetter);
    
    const column = columns.find(col => col.position === colPosition);
    if (!column) return 0;
    
    const row = allRows.find(r => r.id === rowId);
    if (!row) return 0;
    
    const cell = row.cells.find(c => c.columnId === column.id);
    return cell?.value ?? 0;
  };

  // Helper function to get range values
  const getCellRangeValues = (startCell: string, endCell: string, allRows: Row[]): any[] => {
    const values: any[] = [];
    
    const startMatch = startCell.match(/([A-Z]+)(\d+)/);
    const endMatch = endCell.match(/([A-Z]+)(\d+)/);
    if (!startMatch || !endMatch) return values;
    
    const startRow = parseInt(startMatch[2], 10);
    const endRow = parseInt(endMatch[2], 10);
    const startCol = letterToColumnNumber(startMatch[1]);
    const endCol = letterToColumnNumber(endMatch[1]);
    
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const column = columns.find(c => c.position === col);
        if (column) {
          const rowData = allRows.find(r => r.id === row);
          if (rowData) {
            const cell = rowData.cells.find(c => c.columnId === column.id);
            if (cell?.value !== null && cell?.value !== undefined) {
              values.push(cell.value);
            }
          }
        }
      }
    }
    
    return values;
  };

  // Helper function to convert column letters to numbers
  const letterToColumnNumber = (letter: string): number => {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result;
  };

  // 🔧 OPTIMIZED: Fast cell updates with smart delays only for user actions
  const handleCellUpdate = async (rowId: number, columnId: number, value: any, formula?: string, options?: { skipDelay?: boolean }) => {
    try {
      // 🔄 UNDO INTEGRATION: Get old value before update
      const oldRow = rows.find(r => r.id === rowId);
      const oldCell = oldRow?.cells.find(c => c.columnId === columnId);
      const oldValue = oldCell?.value;
      const oldFormula = oldCell?.formula;
      
      const isPasteOperation = options?.skipDelay || false;
      
      console.log('🔧 OPTIMIZED CELL UPDATE:', {
        rowId, columnId,
        oldValue, newValue: value,
        isPasteOperation,
        timestamp: Date.now()
      });
      
      let finalValue = value;
      let errorCode: string | undefined = undefined;
      
      // If a formula was provided, evaluate it
      if (formula) {
        const result = evaluateFormula(formula, rows);
        finalValue = result.value;
        errorCode = result.error;
      }
      
      // 🔧 Update local state IMMEDIATELY for instant UI feedback
      setRows(prevRows => {
        const updatedRows = prevRows.map(row =>
          row.id === rowId
            ? {
                ...row,
                cells: row.cells.map(cell =>
                  cell.columnId === columnId
                    ? { ...cell, value: finalValue, formula, errorCode }
                    : cell
                )
              }
            : row
        );
        
        // Recalculate dependent formulas
        const recalculatedRows = recalculateFormulas(updatedRows);
        
        // Save to localStorage immediately
        saveTableData(recalculatedRows, columns);
        
        return recalculatedRows;
      });
      
      // 🔄 UNDO INTEGRATION: Trigger custom event for undo system
      const column = columns.find(col => col.id === columnId);
      const undoEvent = new CustomEvent('mock-cell-updated', {
        detail: {
          rowId,
          columnId,
          oldValue,
          oldFormula,
          newValue: finalValue,
          newFormula: formula,
          columnName: column?.name || 'Unknown'
        }
      });
      window.dispatchEvent(undoEvent);
      
      // 🔧 PERFORMANCE: Only show toast for user actions, not bulk paste
      if (!isPasteOperation) {
        toast.success('✅ Zelle aktualisiert');
      }
      
    } catch (error) {
      console.error('❌ Error updating cell:', error);
      if (!options?.skipDelay) {
        toast.error('❌ Fehler beim Aktualisieren der Zelle');
      }
    }
  };

  // Recalculate all formulas after an update
  const recalculateFormulas = (allRows: Row[]): Row[] => {
    return allRows.map(row => ({
      ...row,
      cells: row.cells.map(cell => {
        if (cell.formula) {
          const result = evaluateFormula(cell.formula, allRows);
          return { ...cell, value: result.value, errorCode: result.error };
        }
        return cell;
      })
    }));
  };

  // Handle column updates
  const handleColumnUpdate = async (columnId: number, updates: Partial<Column>) => {
    try {
      setIsLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setColumns(prevColumns => {
        const updatedColumns = prevColumns.map(col =>
          col.id === columnId ? { ...col, ...updates } : col
        );
        
        // Save to localStorage
        saveTableData(rows, updatedColumns);
        
        return updatedColumns;
      });
      
      toast.success('Spalte erfolgreich aktualisiert');
    } catch (error) {
      console.error('Error updating column:', error);
      toast.error('Fehler beim Aktualisieren der Spalte');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle column insertion
  const handleColumnInsert = async (afterColumnId: number, direction: 'left' | 'right') => {
    try {
      setIsLoading(true);
      
      const afterColumn = columns.find(col => col.id === afterColumnId);
      if (!afterColumn) return;
      
      const newPosition = direction === 'left' ? afterColumn.position : afterColumn.position + 1;
      
      // Try API first, fallback to local for demo
      try {
        const response = await fetch(`/api/tables/${tableId}/columns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add auth headers when available
          },
          body: JSON.stringify({
            name: `Neue Spalte`,
            type: 'text',
            position: newPosition
          })
        });

        if (response.ok) {
          const result = await response.json();
          const newColumn = result.data;
          
          setColumns(prevColumns => {
            const updatedColumns = prevColumns.map(col =>
              col.position >= newPosition ? { ...col, position: col.position + 1 } : col
            );
            
            updatedColumns.push({
              id: newColumn.id,
              name: newColumn.name,
              type: newColumn.type,
              position: newColumn.position,
              isVisible: true
            });
            
            const sortedColumns = updatedColumns.sort((a, b) => a.position - b.position);
            
            setRows(prevRows => {
              const updatedRows = prevRows.map(row => ({
                ...row,
                cells: [...row.cells, { columnId: newColumn.id, value: '' }]
              }));
              
              // Save both rows and columns
              saveTableData(updatedRows, sortedColumns);
              
              return updatedRows;
            });
            
            return sortedColumns;
          });
          
          toast.success('Neue Spalte eingefügt');
          return;
        }
      } catch (apiError) {
        console.log('API not available, using local fallback');
      }

      // Fallback to local state management for demo
      const newColumnId = Math.max(...columns.map(c => c.id)) + 1;
      
      setColumns(prevColumns => {
        const updatedColumns = prevColumns.map(col =>
          col.position >= newPosition ? { ...col, position: col.position + 1 } : col
        );
        
        updatedColumns.push({
          id: newColumnId,
          name: `Neue Spalte ${newColumnId}`,
          type: 'text',
          position: newPosition,
          isVisible: true
        });
        
        const sortedColumns = updatedColumns.sort((a, b) => a.position - b.position);
        
        setRows(prevRows => {
          const updatedRows = prevRows.map(row => ({
            ...row,
            cells: [...row.cells, { columnId: newColumnId, value: '' }]
          }));
          
          // Save both rows and columns
          saveTableData(updatedRows, sortedColumns);
          
          return updatedRows;
        });
        
        return sortedColumns;
      });
      
      toast.success('Neue Spalte eingefügt');
      
    } catch (error) {
      console.error('Error inserting column:', error);
      toast.error('Fehler beim Einfügen der Spalte');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle column deletion
  const handleColumnDelete = async (columnId: number) => {
    try {
      setIsLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const columnToDelete = columns.find(col => col.id === columnId);
      if (!columnToDelete) return;
      
      // Remove column from columns
      setColumns(prevColumns => {
        const updatedColumns = prevColumns
          .filter(col => col.id !== columnId)
          .map(col =>
            col.position > columnToDelete.position
              ? { ...col, position: col.position - 1 }
              : col
          );
          
        setRows(prevRows => {
          const updatedRows = prevRows.map(row => ({
            ...row,
            cells: row.cells.filter(cell => cell.columnId !== columnId)
          }));
          
          // Save both rows and columns
          saveTableData(updatedRows, updatedColumns);
          
          return updatedRows;
        });
          
        return updatedColumns;
      });
      
      toast.success('Spalte gelöscht');
    } catch (error) {
      console.error('Error deleting column:', error);
      toast.error('Fehler beim Löschen der Spalte');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle column hiding
  const handleColumnHide = async (columnId: number) => {
    try {
      setIsLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setColumns(prevColumns => {
        const updatedColumns = prevColumns.map(col =>
          col.id === columnId ? { ...col, isVisible: false } : col
        );
        
        // Save to localStorage
        saveTableData(rows, updatedColumns);
        
        return updatedColumns;
      });
      
      toast.success('Spalte ausgeblendet');
    } catch (error) {
      console.error('Error hiding column:', error);
      toast.error('Fehler beim Ausblenden der Spalte');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle row addition
  const handleRowAdd = async () => {
    try {
      setIsLoading(true);
      
      // Create default data for new row
      const defaultData: Record<string, any> = {};
      columns.forEach(col => {
        if (col.isVisible !== false) {
          defaultData[col.name] = col.type === 'select' ? 'Active' : col.type === 'number' ? 0 : '';
        }
      });

      // Try API first, fallback to local for demo
      try {
        const response = await fetch(`/api/tables/${tableId}/rows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add auth headers when available
          },
          body: JSON.stringify({ data: defaultData })
        });

        if (response.ok) {
          const result = await response.json();
          const newRowData = result.data;
          
          const newRow: Row = {
            id: newRowData.id,
            cells: columns.map(col => ({
              columnId: col.id,
              value: newRowData.data[col.name] || (col.type === 'select' ? 'Active' : col.type === 'number' ? 0 : ''),
            }))
          };

          setRows(prevRows => {
            const updatedRows = [...prevRows, newRow];
            // Save to localStorage
            saveTableData(updatedRows, columns);
            return updatedRows;
          });
          
          toast.success('Neue Zeile erfolgreich hinzugefügt');
          return;
        }
      } catch (apiError) {
        console.log('API not available, using local fallback');
      }

      // Fallback to local state management for demo
      const newRowId = Math.max(...rows.map(r => r.id), 0) + 1;
      
      const newRow: Row = {
        id: newRowId,
        cells: columns.map(col => ({
          columnId: col.id,
          value: col.type === 'select' ? 'Active' : col.type === 'number' ? 0 : '',
        }))
      };

      setRows(prevRows => {
        const updatedRows = [...prevRows, newRow];
        // Save to localStorage
        saveTableData(updatedRows, columns);
        return updatedRows;
      });
      
      toast.success('Neue Zeile erfolgreich hinzugefügt');
      
    } catch (error) {
      console.error('Error adding row:', error);
      toast.error('Fehler beim Hinzufügen der Zeile');
    } finally {
      setIsLoading(false);
    }
  };

  // Row delete handler
  const handleRowDelete = async (rowIds: number[]) => {
    try {
      setIsLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Remove deleted rows
      setRows(prevRows => {
        const updatedRows = prevRows.filter(row => !rowIds.includes(row.id));
        // Save to localStorage
        saveTableData(updatedRows, columns);
        return updatedRows;
      });
      
      toast.success(`${rowIds.length} Datensatz${rowIds.length > 1 ? 'e' : ''} gelöscht`);
    } catch (error) {
      console.error('Error deleting rows:', error);
      toast.error('Fehler beim Löschen der Datensätze');
    } finally {
      setIsLoading(false);
    }
  };

  // Row hide handler - sets hidden flag instead of removing
  const handleRowHide = async (rowIds: number[]) => {
    try {
      setIsLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Set isHidden flag for specified rows
      setRows(prevRows => {
        const updatedRows = prevRows.map(row =>
          rowIds.includes(row.id) ? { ...row, isHidden: true } : row
        );
        // Save to localStorage
        saveTableData(updatedRows, columns);
        return updatedRows;
      });
      
      toast.success(`${rowIds.length} Datensatz${rowIds.length > 1 ? 'e' : ''} ausgeblendet`);
    } catch (error) {
      console.error('Error hiding rows:', error);
      toast.error('Fehler beim Ausblenden der Datensätze');
    } finally {
      setIsLoading(false);
    }
  };

  // Row unhide handler - removes hidden flag
  const handleRowUnhide = async (rowIds: number[]) => {
    try {
      setIsLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Remove isHidden flag for specified rows
      setRows(prevRows => {
        const updatedRows = prevRows.map(row =>
          rowIds.includes(row.id) ? { ...row, isHidden: false } : row
        );
        // Save to localStorage
        saveTableData(updatedRows, columns);
        return updatedRows;
      });
      
      toast.success(`${rowIds.length} Datensatz${rowIds.length > 1 ? 'e' : ''} eingeblendet`);
    } catch (error) {
      console.error('Error unhiding rows:', error);
      toast.error('Fehler beim Einblenden der Datensätze');
    } finally {
      setIsLoading(false);
    }
  };

  // CSV Import/Export handlers
  const handleCSVImport = async (file: File, mappings?: any) => {
    try {
      setIsLoading(true);
      
      // Try API first, then fall back to local import for demo
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        if (mappings) {
          formData.append('mappings', JSON.stringify(mappings));
        }

        const response = await fetch(`/api/tables/${tableId}/import/csv`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          toast.success(`${result.data.imported} rows imported successfully`);
          
          // Reload table data
          loadTableData(tableId);
          return;
        } else {
          console.log('API import failed, using local fallback');
        }
      } catch (apiError) {
        console.log('API not available, using local fallback');
      }

      // Local fallback import
      await importCSVLocally(file);
      
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Error importing CSV');
    } finally {
      setIsLoading(false);
    }
  };

  // Local CSV import fallback for demo
  const importCSVLocally = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const csvText = e.target?.result as string;
          if (!csvText) {
            throw new Error('Could not read file');
          }

          // Parse CSV
          const lines = csvText.split('\n').filter(line => line.trim());
          if (lines.length === 0) {
            throw new Error('CSV file is empty');
          }

          // Parse header row
          const headerLine = lines[0];
          const headers = parseCSVRow(headerLine);
          
          if (headers.length === 0) {
            throw new Error('No headers found in CSV');
          }

          // Parse data rows
          const dataRows = lines.slice(1).map(line => parseCSVRow(line));
          const validRows = dataRows.filter(row => row.length > 0);

          if (validRows.length === 0) {
            toast.warning('No data rows found in CSV');
            resolve();
            return;
          }

          // Create new columns for headers that don't exist
          const existingColumnNames = columns.map(col => col.name.toLowerCase());
          const newColumns = [...columns];
          let maxPosition = Math.max(...columns.map(col => col.position), 0);

          headers.forEach((header, index) => {
            const headerLower = header.toLowerCase();
            if (!existingColumnNames.includes(headerLower)) {
              maxPosition++;
              newColumns.push({
                id: Math.max(...columns.map(c => c.id), 0) + newColumns.length - columns.length + 1,
                name: header,
                type: detectColumnType(validRows.map(row => row[index] || '')),
                position: maxPosition,
                isVisible: true
              });
            }
          });

          // Create new rows
          let maxRowId = Math.max(...rows.map(r => r.id), 0);
          const newRows = [...rows];

          validRows.forEach(rowData => {
            maxRowId++;
            const cells = headers.map((header, headerIndex) => {
              const column = newColumns.find(col =>
                col.name.toLowerCase() === header.toLowerCase()
              );
              
              if (!column) return null;

              let value = rowData[headerIndex] || '';
              
              // Convert value based on column type
              if (column.type === 'number' && value) {
                const numValue = parseFloat(value);
                value = isNaN(numValue) ? '0' : numValue.toString();
              } else if (column.type === 'select') {
                value = value || 'Active';
              }

              return {
                columnId: column.id,
                value
              };
            }).filter(Boolean) as Array<{columnId: number, value: any}>;

            newRows.push({
              id: maxRowId,
              cells
            });
          });

          // Update state
          setColumns(newColumns);
          setRows(newRows);
          
          // Save to localStorage
          saveTableData(newRows, newColumns);

          toast.success(`Successfully imported ${validRows.length} rows with ${headers.length} columns`);
          resolve();

        } catch (error) {
          console.error('Error parsing CSV:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };

      reader.readAsText(file);
    });
  };

  // Helper function to parse CSV row
  const parseCSVRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    
    return result;
  };

  // Helper function to detect column type
  const detectColumnType = (values: string[]): string => {
    const nonEmptyValues = values.filter(v => v && v.trim());
    
    if (nonEmptyValues.length === 0) return 'text';
    
    // Check if all are numbers
    if (nonEmptyValues.every(v => !isNaN(parseFloat(v)) && isFinite(parseFloat(v)))) {
      return 'number';
    }
    
    // Check if all are emails
    if (nonEmptyValues.every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
      return 'email';
    }
    
    // Check if all are dates
    if (nonEmptyValues.every(v => !isNaN(Date.parse(v)))) {
      return 'date';
    }
    
    // Check if it looks like select values (limited unique values)
    const uniqueValues = [...new Set(nonEmptyValues)];
    if (uniqueValues.length <= 10 && nonEmptyValues.length > uniqueValues.length * 2) {
      return 'select';
    }
    
    return 'text';
  };

  const handleCSVExport = async (options?: { includeFormulas?: boolean }) => {
    try {
      setIsLoading(true);
      
      // Try API first, then fall back to local export for demo
      try {
        const params = new URLSearchParams();
        if (options?.includeFormulas) {
          params.set('includeFormulas', 'true');
        }

        const response = await fetch(`/api/tables/${tableId}/export/csv?${params.toString()}`);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/csv')) {
            // CSV response
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${mockTableData.name}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            toast.success('CSV exported successfully');
            return;
          } else {
            // JSON response with files
            const result = await response.json();
            if (result.files) {
              // Handle multiple files (CSV + formulas)
              for (const [filename, content] of Object.entries(result.files)) {
                const blob = new Blob([content as string], {
                  type: filename.endsWith('.json') ? 'application/json' : 'text/csv'
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              }
              toast.success('CSV exported successfully');
              return;
            }
          }
        } else {
          // API error, fall back to local export
          console.log('API export failed, using local fallback');
        }
      } catch (apiError) {
        // API error, fall back to local export
        console.log('API not available, using local fallback');
      }

      // Local fallback export
      exportCSVLocally(options?.includeFormulas || false);
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Error exporting CSV');
    } finally {
      setIsLoading(false);
    }
  };

  // Local CSV export fallback for demo
  const exportCSVLocally = (includeFormulas: boolean) => {
    try {
      // Determine rows to export: selected rows OR all visible rows
      const rowsToExport = selectedRows.size > 0
        ? rows.filter(row => selectedRows.has(row.id) && !row.isHidden)
        : rows.filter(row => !row.isHidden);
      
      // Generate CSV headers
      const headers = visibleColumns.map(col => col.name);
      let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
      
      // Generate CSV rows
      for (const row of rowsToExport) {
        const rowValues = visibleColumns.map(column => {
          const cell = row.cells.find(c => c.columnId === column.id);
          let value = cell?.value || '';
          
          // Handle different data types
          if (typeof value === 'string') {
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              value = `"${value.replace(/"/g, '""')}"`;
            }
          } else if (value !== null && value !== undefined) {
            value = String(value);
          } else {
            value = '';
          }
          
          return value;
        });
        
        csvContent += rowValues.join(',') + '\n';
      }
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const exportScope = selectedRows.size > 0 ? `${selectedRows.size}_selected` : 'all';
      const filename = `${mockTableData.name}_${timestamp}_${exportScope}.csv`;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      if (includeFormulas) {
        // Also export formulas as JSON
        const formulaData = {
          table: mockTableData.name,
          exportedAt: new Date().toISOString(),
          formulas: rowsToExport.reduce((acc, row) => {
            const rowFormulas: Record<string, string> = {};
            visibleColumns.forEach(column => {
              const cell = row.cells.find(c => c.columnId === column.id);
              if (cell?.formula) {
                rowFormulas[column.name] = cell.formula;
              }
            });
            if (Object.keys(rowFormulas).length > 0) {
              acc[`Row_${row.id}`] = rowFormulas;
            }
            return acc;
          }, {} as Record<string, Record<string, string>>)
        };
        
        const formulaBlob = new Blob([JSON.stringify(formulaData, null, 2)], {
          type: 'application/json;charset=utf-8;'
        });
        const formulaUrl = window.URL.createObjectURL(formulaBlob);
        const formulaLink = document.createElement('a');
        formulaLink.href = formulaUrl;
        formulaLink.download = `${mockTableData.name}_${timestamp}_formulas.json`;
        document.body.appendChild(formulaLink);
        formulaLink.click();
        window.URL.revokeObjectURL(formulaUrl);
        document.body.removeChild(formulaLink);
      }
      
      const scopeText = selectedRows.size > 0 ? `${selectedRows.size} markierte Zeilen` : 'alle Zeilen';
      toast.success(`CSV (${scopeText}) erfolgreich exportiert`);
    } catch (error) {
      console.error('Error in local CSV export:', error);
      toast.error('Error exporting CSV');
    }
  };

  // Get visible columns for export
  const visibleColumns = columns.filter(col => col.isVisible !== false);

  // JSON Export handler
  const handleJSONExport = async (exportType: 'formulas' | 'values') => {
    try {
      setIsLoading(true);
      
      // Determine rows to export: selected rows OR all visible rows
      const rowsToExport = selectedRows.size > 0
        ? rows.filter(row => selectedRows.has(row.id) && !row.isHidden)
        : rows.filter(row => !row.isHidden);
      
      // Generate JSON data
      const timestamp = new Date().toISOString().split('T')[0];
      const exportScope = selectedRows.size > 0 ? `${selectedRows.size}_selected` : 'all';
      const filename = `${mockTableData.name}_${timestamp}_${exportScope}_${exportType}.json`;
      
      const visibleColumns = columns.filter(col => col.isVisible !== false);
      
      let jsonData;
      
      if (exportType === 'formulas') {
        // Export formulas structure
        jsonData = {
          table: {
            name: mockTableData.name,
            id: mockTableData.id,
            exportedAt: new Date().toISOString(),
            exportType: 'formulas'
          },
          columns: visibleColumns.map(col => ({
            id: col.id,
            name: col.name,
            type: col.type,
            position: col.position,
            isComputed: col.isComputed
          })),
          formulas: rowsToExport.reduce((acc, row) => {
            const rowFormulas: Record<string, string> = {};
            visibleColumns.forEach(column => {
              const cell = row.cells.find(c => c.columnId === column.id);
              if (cell?.formula) {
                rowFormulas[column.name] = cell.formula;
              }
            });
            if (Object.keys(rowFormulas).length > 0) {
              acc[`Row_${row.id}`] = rowFormulas;
            }
            return acc;
          }, {} as Record<string, Record<string, string>>),
          metadata: {
            totalRows: rowsToExport.length,
            totalColumns: visibleColumns.length,
            rowsWithFormulas: rowsToExport.filter(row =>
              row.cells.some(cell => cell.formula)
            ).length,
            exportScope: selectedRows.size > 0 ? 'selected' : 'all',
            selectedRowCount: selectedRows.size
          }
        };
      } else {
        // Export values structure
        jsonData = {
          table: {
            name: mockTableData.name,
            id: mockTableData.id,
            exportedAt: new Date().toISOString(),
            exportType: 'values'
          },
          columns: visibleColumns.map(col => ({
            id: col.id,
            name: col.name,
            type: col.type,
            position: col.position
          })),
          data: rowsToExport.map(row => {
            const rowData: Record<string, any> = {
              id: row.id
            };
            visibleColumns.forEach(column => {
              const cell = row.cells.find(c => c.columnId === column.id);
              rowData[column.name] = cell?.value || null;
            });
            return rowData;
          }),
          metadata: {
            totalRows: rowsToExport.length,
            totalColumns: visibleColumns.length,
            exportFormat: 'JSON',
            exportScope: selectedRows.size > 0 ? 'selected' : 'all',
            selectedRowCount: selectedRows.size
          }
        };
      }
      
      // Create and download file
      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      const scopeText = selectedRows.size > 0 ? `${selectedRows.size} markierte Zeilen` : 'alle Zeilen';
      toast.success(`JSON ${exportType === 'formulas' ? 'mit Formeln' : 'mit Werten'} (${scopeText}) erfolgreich exportiert`);
      
    } catch (error) {
      console.error('Error exporting JSON:', error);
      toast.error('Fehler beim JSON Export');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/workspaces">Workspaces</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/dashboard/workspaces/${mockTableData.workspaceId}`}>
                {mockTableData.workspaceName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{mockTableData.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{mockTableData.name}</h1>
            <p className="text-muted-foreground mt-1">{mockTableData.description}</p>
          </div>
        </div>

        {/* Search and CSV Import/Export */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search table data..."
              className="pl-8 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCSVImport(file);
              }}
              className="hidden"
              id="csv-file-input"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => document.getElementById('csv-file-input')?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              CSV Importieren
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCSVExport()}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV Exportieren
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <FileText className="h-4 w-4 mr-1" />
                  JSON exportieren
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleJSONExport('formulas')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Mit Formeln
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleJSONExport('values')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Mit Werten
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Enhanced Data Table */}
        <EnhancedDataTable
          tableId={tableId}
          columns={columns}
          rows={filteredRows}
          onCellUpdate={handleCellUpdate}
          onRowsUpdate={setRows}
          onRowAdd={handleRowAdd}
          onRowDelete={handleRowDelete}
          onRowHide={handleRowHide}
          onRowUnhide={handleRowUnhide}
          onColumnUpdate={handleColumnUpdate}
          onColumnInsert={handleColumnInsert}
          onColumnDelete={handleColumnDelete}
          onColumnHide={handleColumnHide}
          onCSVImport={handleCSVImport}
          onCSVExport={handleCSVExport}
          selectedRows={selectedRows}
          onSelectedRowsChange={setSelectedRows}
        />

        {/* Table Stats - simplified */}
        {(searchQuery || rows.some(r => r.isHidden)) && (
          <div className="text-sm text-muted-foreground space-y-1">
            {searchQuery && (
              <div>
                Showing {filteredRows.filter(r => !r.isHidden).length} of {rows.filter(r => !r.isHidden).length} visible rows
              </div>
            )}
            {rows.some(r => r.isHidden) && (
              <div>
                {rows.filter(r => r.isHidden).length} row{rows.filter(r => r.isHidden).length > 1 ? 's' : ''} hidden
              </div>
            )}
            {isLoading && <span className="text-blue-600">Updating...</span>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}