'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  Check, 
  X, 
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';

// A1 notation utilities (copied from engine to avoid server imports)
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

// Verfügbare Funktionen für Autocomplete
const FORMULA_FUNCTIONS = [
  { name: 'SUM', description: 'Summe eines Bereichs', syntax: 'SUM(range)' },
  { name: 'AVERAGE', description: 'Durchschnitt eines Bereichs', syntax: 'AVERAGE(range)' },
  { name: 'MIN', description: 'Minimum eines Bereichs', syntax: 'MIN(range)' },
  { name: 'MAX', description: 'Maximum eines Bereichs', syntax: 'MAX(range)' },
  { name: 'COUNT', description: 'Anzahl (nur Zahlen)', syntax: 'COUNT(range)' },
  { name: 'ROUND', description: 'Runden', syntax: 'ROUND(number, digits)' },
  { name: 'ABS', description: 'Betrag', syntax: 'ABS(number)' },
  { name: 'IF', description: 'Bedingte Anweisung', syntax: 'IF(condition, true_value, false_value)' },
  { name: 'IFERROR', description: 'Fehlerbehandlung', syntax: 'IFERROR(value, error_value)' },
  { name: 'AND', description: 'Logisches UND', syntax: 'AND(logical1, logical2, ...)' },
  { name: 'OR', description: 'Logisches ODER', syntax: 'OR(logical1, logical2, ...)' },
  { name: 'NOT', description: 'Logisches NICHT', syntax: 'NOT(logical)' },
  { name: 'LEN', description: 'Textlänge', syntax: 'LEN(text)' },
  { name: 'LEFT', description: 'Zeichen von links', syntax: 'LEFT(text, chars)' },
  { name: 'RIGHT', description: 'Zeichen von rechts', syntax: 'RIGHT(text, chars)' },
  { name: 'MID', description: 'Zeichen aus der Mitte', syntax: 'MID(text, start, length)' },
  { name: 'UPPER', description: 'Großbuchstaben', syntax: 'UPPER(text)' },
  { name: 'LOWER', description: 'Kleinbuchstaben', syntax: 'LOWER(text)' },
  { name: 'TRIM', description: 'Leerzeichen entfernen', syntax: 'TRIM(text)' },
  { name: 'CONCATENATE', description: 'Texte verbinden', syntax: 'CONCATENATE(text1, text2, ...)' },
];

export interface FormulaBarProps {
  // Aktuelle fokussierte Zelle
  focusedCell: {
    rowId: number;
    columnId: number;
    columnName: string;
    value: any;
    formula?: string;
    errorCode?: string;
  } | null;
  
  // Verfügbare Spalten für Referenzen
  columns: Array<{
    id: number;
    name: string;
    position: number;
  }>;
  
  // Callbacks
  onFormulaSubmit: (formula: string) => Promise<void>;
  onFormulaCancel: () => void;
  onCellRangeSelect?: (range: string) => void;
  onRegisterRangeInserter?: (inserter: (range: string) => void) => void;
}

export function FormulaBar({
  focusedCell,
  columns,
  onFormulaSubmit,
  onFormulaCancel,
  onCellRangeSelect,
  onRegisterRangeInserter
}: FormulaBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formulaInput, setFormulaInput] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Range insertion function - called when parent detects range selection
  const insertRange = useCallback((range: string) => {
    if (inputRef.current && isEditing) {
      const input = inputRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentValue = input.value;
      
      const newValue = currentValue.slice(0, start) + range + currentValue.slice(end);
      setFormulaInput(newValue);
      
      // Position cursor after inserted range
      setTimeout(() => {
        if (input) {
          input.focus();
          input.setSelectionRange(start + range.length, start + range.length);
        }
      }, 0);
    }
  }, [isEditing]);

  // Register the range inserter with parent when editing starts
  useEffect(() => {
    if (isEditing && onRegisterRangeInserter) {
      onRegisterRangeInserter(insertRange);
    }
  }, [isEditing, onRegisterRangeInserter, insertRange]);
  
  // A1-Referenz für aktuelle Zelle
  const currentCellRef = focusedCell
    ? coordsToA1(focusedCell.rowId, getColumnPosition(focusedCell.columnId))
    : null;
  
  // Hilfsfunktion: Column Position finden
  function getColumnPosition(columnId: number): number {
    const column = columns.find(col => col.id === columnId);
    return column?.position || 1;
  }
  
  // Hilfsfunktion: Column Name für Position
  function getColumnNameByPosition(position: number): string {
    const column = columns.find(col => col.position === position);
    return column?.name || columnToLetter(position);
  }
  
  // Reset bei Zell-Wechsel
  useEffect(() => {
    if (focusedCell) {
      setIsEditing(false);
      setFormulaInput(focusedCell.formula || focusedCell.value?.toString() || '');
    }
  }, [focusedCell]);
  
  // Bearbeitung starten
  const startEditing = () => {
    setIsEditing(true);
    setFormulaInput(focusedCell?.formula || focusedCell?.value?.toString() || '');
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  
  // Formel speichern
  const handleSubmit = async () => {
    if (!formulaInput.trim()) {
      setIsEditing(false);
      return;
    }
    
    try {
      await onFormulaSubmit(formulaInput);
      setIsEditing(false);
    } catch (error) {
      console.error('Fehler beim Speichern der Formel:', error);
    }
  };
  
  // Bearbeitung abbrechen
  const handleCancel = () => {
    setIsEditing(false);
    setFormulaInput(focusedCell?.formula || focusedCell?.value?.toString() || '');
    onFormulaCancel();
  };
  
  // Autocomplete-Filterung
  const getFilteredSuggestions = () => {
    const input = formulaInput.toLowerCase();
    const cursorText = formulaInput.substring(0, cursorPosition);
    const lastWordMatch = cursorText.match(/[A-Z]+$/i);
    const searchTerm = lastWordMatch ? lastWordMatch[0].toLowerCase() : '';
    
    if (!searchTerm) return [];
    
    // Funktionen filtern
    const functions = FORMULA_FUNCTIONS.filter(func => 
      func.name.toLowerCase().startsWith(searchTerm)
    );
    
    // Spalten filtern
    const columnSuggestions = columns
      .filter(col => col.name.toLowerCase().includes(searchTerm))
      .map(col => ({
        name: col.name,
        description: `Spalte ${columnToLetter(col.position)}`,
        syntax: col.name,
        isColumn: true
      }));
    
    return [...functions, ...columnSuggestions];
  };
  
  // Autocomplete-Auswahl anwenden
  const applySuggestion = (suggestion: any) => {
    const cursorText = formulaInput.substring(0, cursorPosition);
    const remainingText = formulaInput.substring(cursorPosition);
    const lastWordMatch = cursorText.match(/[A-Z]+$/i);
    
    if (lastWordMatch) {
      const newText = cursorText.substring(0, cursorText.length - lastWordMatch[0].length) + 
        (suggestion.isColumn ? suggestion.name : suggestion.syntax) + 
        remainingText;
      setFormulaInput(newText);
    }
    
    setShowAutocomplete(false);
  };
  
  // Input-Handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormulaInput(value);
    setCursorPosition(e.target.selectionStart || 0);
    
    // Autocomplete anzeigen wenn Buchstaben getippt werden
    const shouldShow = /[A-Z]$/i.test(value.substring(0, e.target.selectionStart || 0));
    setShowAutocomplete(shouldShow);
  };
  
  // Keyboard-Handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };
  
  // Anzeige-Wert bestimmen
  const getDisplayValue = () => {
    if (!focusedCell) return '';
    
    if (focusedCell.formula) {
      return focusedCell.formula;
    }
    
    return focusedCell.value?.toString() || '';
  };
  
  if (!focusedCell) {
    return (
      <div className="h-12 border-b bg-background flex items-center px-4">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Calculator className="h-4 w-4" />
          <span className="text-sm">Wählen Sie eine Zelle aus...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-12 border-b bg-background flex items-center px-4 space-x-3">
      {/* Zell-Referenz */}
      <div className="flex items-center space-x-2 min-w-0">
        <Badge variant="outline" className="font-mono text-xs">
          {currentCellRef}
        </Badge>
        {focusedCell.errorCode && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive">
                <AlertTriangle className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-2">
                <div className="font-semibold text-destructive">Formel-Fehler</div>
                <div className="text-sm text-muted-foreground">
                  {focusedCell.errorCode}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      
      {/* fx-Icon */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={startEditing}
      >
        <Calculator className="h-4 w-4" />
      </Button>
      
      {/* Formel-/Wert-Eingabe */}
      <div className="flex-1 relative">
        {isEditing ? (
          <div className="flex items-center space-x-2 relative">
            <Input
              ref={inputRef}
              value={formulaInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="font-mono text-sm"
              placeholder="Geben Sie eine Formel oder einen Wert ein... (Shift+Klick für Bereichsauswahl)"
              autoFocus
            />
            
            {/* Autocomplete Dropdown */}
            {showAutocomplete && getFilteredSuggestions().length > 0 && (
              <div className="absolute top-full left-0 z-50 w-80 mt-1 bg-popover border rounded-md shadow-lg">
                <Command>
                  <CommandEmpty>Keine Vorschläge gefunden.</CommandEmpty>
                  <CommandGroup heading="Funktionen & Spalten">
                    {getFilteredSuggestions().map((suggestion, index) => (
                      <CommandItem
                        key={index}
                        onSelect={() => applySuggestion(suggestion)}
                        className="cursor-pointer"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold">{suggestion.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {suggestion.description}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </div>
            )}
            
            {/* Aktions-Buttons */}
            <Button size="sm" variant="ghost" onClick={handleSubmit}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="flex items-center h-8 px-3 font-mono text-sm cursor-pointer hover:bg-accent rounded-md"
            onClick={startEditing}
          >
            {getDisplayValue() || <span className="text-muted-foreground italic">Leer</span>}
          </div>
        )}
      </div>
      
      {/* Spalten-Info */}
      <div className="text-xs text-muted-foreground min-w-0">
        {focusedCell.columnName}
      </div>
    </div>
  );
}