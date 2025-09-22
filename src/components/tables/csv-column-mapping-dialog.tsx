'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Plus, FileText, Table, CheckCircle, AlertCircle } from 'lucide-react';
import { parseCSV, detectColumnType, generateColumnMapping, validateCSVImport, type ColumnMapping } from '@/lib/csv-utils';

export interface Column {
  id: number;
  name: string;
  type: string;
  position: number;
}

interface CSVColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  csvFile: File | null;
  existingColumns: Column[];
  onConfirm: (mappings: ColumnMapping[], createMissingColumns: boolean) => void;
  onCancel: () => void;
}

export function CSVColumnMappingDialog({
  open,
  onOpenChange,
  csvFile,
  existingColumns,
  onConfirm,
  onCancel
}: CSVColumnMappingDialogProps) {
  const [csvData, setCSVData] = useState<{ headers: string[]; rows: string[][]; totalRows: number } | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [createMissingColumns, setCreateMissingColumns] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse CSV file when dialog opens
  useEffect(() => {
    if (open && csvFile) {
      setIsLoading(true);
      setParseError(null);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvContent = e.target?.result as string;
          const parseResult = parseCSV(csvContent);
          setCSVData(parseResult);
          
          // Generate initial mappings
          const initialMappings = generateColumnMapping(parseResult.headers, existingColumns);
          setColumnMappings(initialMappings);
        } catch (error) {
          setParseError(error instanceof Error ? error.message : 'Fehler beim Parsen der CSV-Datei');
        } finally {
          setIsLoading(false);
        }
      };
      
      reader.onerror = () => {
        setParseError('Fehler beim Lesen der Datei');
        setIsLoading(false);
      };
      
      reader.readAsText(csvFile);
    }
  }, [open, csvFile, existingColumns]);

  const handleMappingChange = (csvColumnIndex: number, tableColumnId: number) => {
    setColumnMappings(prev => prev.map(mapping => {
      if (mapping.csvColumnIndex === csvColumnIndex) {
        const existingColumn = existingColumns.find(col => col.id === tableColumnId);
        return {
          ...mapping,
          tableColumnId,
          tableColumnName: existingColumn?.name || '',
          createNew: tableColumnId === -1
        };
      }
      return mapping;
    }));
  };

  const getValidationResult = () => {
    if (!csvData) return { isValid: false, errors: ['Keine CSV-Daten verfügbar'] };
    return validateCSVImport(csvData, columnMappings);
  };

  const validationResult = getValidationResult();
  const validMappings = columnMappings.filter(m => m.tableColumnId > 0 || m.createNew);
  const newColumnsCount = columnMappings.filter(m => m.createNew).length;

  const getSampleValues = (columnIndex: number): string[] => {
    if (!csvData) return [];
    return csvData.rows.slice(0, 3).map(row => row[columnIndex] || '').filter(v => v.trim());
  };

  const getDetectedType = (columnIndex: number): string => {
    const sampleValues = getSampleValues(columnIndex);
    return detectColumnType(sampleValues);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Table className="h-5 w-5 mr-2" />
            CSV Spalten-Zuordnung
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">CSV-Datei wird analysiert...</p>
          </div>
        )}

        {parseError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Fehler</h3>
                <p className="text-sm text-red-700 mt-1">{parseError}</p>
              </div>
            </div>
          </div>
        )}

        {csvData && !isLoading && !parseError && (
          <div className="space-y-6">
            {/* File Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Datei-Informationen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Datei:</span>
                    <p className="truncate">{csvFile?.name}</p>
                  </div>
                  <div>
                    <span className="font-medium">Spalten:</span>
                    <p>{csvData.headers.length}</p>
                  </div>
                  <div>
                    <span className="font-medium">Zeilen:</span>
                    <p>{csvData.totalRows}</p>
                  </div>
                  <div>
                    <span className="font-medium">Größe:</span>
                    <p>{Math.round((csvFile?.size || 0) / 1024)} KB</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Column Mappings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Spalten-Zuordnung</CardTitle>
                <p className="text-sm text-gray-600">
                  Ordnen Sie CSV-Spalten den Tabellenspalten zu oder erstellen Sie neue Spalten.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {columnMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg bg-gray-50">
                      {/* CSV Column */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="outline" className="text-xs">CSV</Badge>
                          <span className="font-medium truncate">{mapping.csvColumnName}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p>Typ: <span className="font-mono">{getDetectedType(mapping.csvColumnIndex)}</span></p>
                          {getSampleValues(mapping.csvColumnIndex).length > 0 && (
                            <p className="mt-1">
                              Beispiele: {getSampleValues(mapping.csvColumnIndex).slice(0, 2).map(v => 
                                `"${v.length > 20 ? v.substring(0, 20) + '...' : v}"`
                              ).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />

                      {/* Table Column Selection */}
                      <div className="flex-1 min-w-0">
                        <Select
                          value={mapping.tableColumnId.toString()}
                          onValueChange={(value) => handleMappingChange(mapping.csvColumnIndex, parseInt(value))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Spalte auswählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1" className="text-blue-600">
                              <div className="flex items-center">
                                <Plus className="h-4 w-4 mr-2" />
                                Neue Spalte erstellen
                              </div>
                            </SelectItem>
                            {existingColumns.map((column) => (
                              <SelectItem key={column.id} value={column.id.toString()}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{column.name}</span>
                                  <Badge variant="secondary" className="text-xs ml-2">
                                    {column.type}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {mapping.tableColumnId > 0 && (
                          <div className="mt-1 text-xs text-gray-600">
                            Vorhandene Spalte: {mapping.tableColumnName}
                          </div>
                        )}
                        {mapping.createNew && (
                          <div className="mt-1 text-xs text-blue-600">
                            Neue Spalte wird erstellt
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Options */}
                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="create-missing"
                      checked={createMissingColumns}
                      onChange={(e) => setCreateMissingColumns(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="create-missing" className="text-sm">
                      Fehlende Spalten automatisch erstellen
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Validation Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  {validationResult.isValid ? (
                    <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
                  )}
                  Import-Zusammenfassung
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="font-medium">Zugeordnete Spalten:</span>
                    <p className="text-lg font-semibold text-green-600">{validMappings.length}</p>
                  </div>
                  <div>
                    <span className="font-medium">Neue Spalten:</span>
                    <p className="text-lg font-semibold text-blue-600">{newColumnsCount}</p>
                  </div>
                  <div>
                    <span className="font-medium">Zu importierende Zeilen:</span>
                    <p className="text-lg font-semibold">{csvData.totalRows}</p>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <p className={`text-lg font-semibold ${
                      validationResult.isValid ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {validationResult.isValid ? 'Bereit' : 'Fehler'}
                    </p>
                  </div>
                </div>

                {!validationResult.isValid && validationResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <h4 className="font-medium text-red-800 mb-2">Probleme gefunden:</h4>
                    <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                      {validationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            onClick={() => onConfirm(columnMappings, createMissingColumns)}
            disabled={!validationResult.isValid || !csvData}
          >
            Import starten ({validMappings.length} Spalten)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}