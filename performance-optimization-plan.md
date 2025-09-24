# Performance-Optimierung: Chunked Bulk-Update für Copy & Paste

## Übersicht
Diese Spezifikation beschreibt die Implementierung eines Chunked Bulk-Update Systems, das die Performance beim Einfügen kopierter Daten um ~90% verbessert.

## Problem
- Aktuell: N+1 API-Calls (100 Zellen = 100 API-Calls)
- Jeder Call: ~50-100ms
- Gesamtzeit: 5-10 Sekunden für mittelgroße Datenmengen
- Schlechte UX durch sequenzielle Verarbeitung

## Lösung: 3-Stufen Chunked Bulk-Update

### 1. Backend API-Endpunkt

**Neuer Endpunkt:** `POST /api/tables/[id]/cells/bulk`

```typescript
// Interface für Bulk-Update Request
interface BulkCellUpdate {
  cells: Array<{
    rowId: number;
    columnId: number; 
    value: any;
    formula?: string;
  }>;
  options: {
    skipFormulaRecalc?: boolean;
    chunkId?: string;
    isLastChunk?: boolean;
  };
}

// Response Interface
interface BulkUpdateResponse {
  success: boolean;
  updatedCount: number;
  errors: Array<{
    rowId: number;
    columnId: number;
    error: string;
  }>;
  affectedCells?: Array<{
    id: number;
    value: any;
    error?: string;
  }>;
}
```

**Optimierte Verarbeitung:**
- Batch-SQL-Updates mit CASE-WHEN für bessere Performance
- Transaktion für atomare Updates
- Formel-Recalculation nur am Ende (bei isLastChunk=true)
- Parallele Verarbeitung von unabhängigen Zellen

### 2. Frontend Chunking-Strategie

**Chunk-Größen basierend auf Datenmenge:**
```typescript
const CHUNK_STRATEGY = {
  small: { size: 50, parallel: 2 },    // <500 Zellen
  medium: { size: 100, parallel: 3 },  // 500-2000 Zellen  
  large: { size: 200, parallel: 4 },   // 2000-5000 Zellen
  huge: { size: 500, parallel: 2 }     // >5000 Zellen
};
```

**Optimierte Paste-Funktion:**
```typescript
const handlePasteOptimized = async (pasteData: string[][]) => {
  // 1. Datenmenge analysieren
  const totalCells = pasteData.flat().length;
  const strategy = getOptimalStrategy(totalCells);
  
  // 2. Daten in Chunks aufteilen
  const chunks = createOptimalChunks(pasteData, strategy);
  
  // 3. Optimistische UI-Updates (sofort)
  applyOptimisticUpdates(chunks);
  
  // 4. Parallel Chunk-Processing
  const results = await processChunksInParallel(chunks, strategy);
  
  // 5. Error-Handling und Rollback bei Fehlern
  if (results.some(r => !r.success)) {
    await handlePartialFailure(results);
  }
};
```

### 3. Database-Optimierungen

**SQL-Optimierungen für Bulk-Updates:**
```sql
-- Statt N einzelne Updates:
UPDATE cells SET 
  value_json = CASE 
    WHEN id = $1 THEN $2
    WHEN id = $3 THEN $4
    -- ... weitere CASE-Statements
    ELSE value_json 
  END,
  updated_at = NOW()
WHERE id IN ($1, $3, $5, ...);

-- Oder mit VALUES-Tabelle für große Batches:
UPDATE cells SET 
  value_json = updates.value_json,
  formula = updates.formula,
  updated_at = NOW()
FROM (VALUES 
  (1, '{"value": "data1"}', null),
  (2, '{"value": "data2"}', null),
  -- ...
) AS updates(id, value_json, formula)
WHERE cells.id = updates.id;
```

**Index-Optimierungen:**
```sql
-- Composite Index für bessere Bulk-Update Performance
CREATE INDEX CONCURRENTLY idx_cells_bulk_update 
ON cells (row_id, column_id) 
INCLUDE (value_json, formula, error_code);
```

### 4. Formel-Engine Integration

**Optimierte Formel-Recalculation:**
```typescript
class OptimizedFormulaEngine {
  // Sammle alle geänderten Zellen
  private pendingUpdates: Set<string> = new Set();
  
  async batchUpdateCells(cells: BulkCellUpdate[]): Promise<void> {
    // 1. Alle Zellen-Updates sammeln
    for (const cell of cells) {
      const a1Ref = this.cellMapper.cellToA1(cell.rowId, cell.columnId);
      this.pendingUpdates.add(a1Ref);
      
      if (cell.formula) {
        await this.setCellFormula(a1Ref, cell.formula);
      } else {
        await this.setCellValue(a1Ref, cell.value);
      }
    }
  }
  
  async recalculateAllPending(): Promise<RecalcResult> {
    // Einmalige Recalculation aller betroffenen Formeln
    const result = await this.recalcAffected(Array.from(this.pendingUpdates));
    this.pendingUpdates.clear();
    return result;
  }
}
```

### 5. Frontend UX-Verbesserungen

**Progress-Tracking:**
```typescript
interface PasteProgress {
  totalCells: number;
  processedCells: number;
  currentChunk: number;
  totalChunks: number;
  errors: number;
  eta: number; // Estimated Time of Arrival
}

const showPasteProgress = (progress: PasteProgress) => {
  // Progress Bar für große Datenmengen (>1000 Zellen)
  if (progress.totalCells > 1000) {
    displayProgressModal(progress);
  }
};
```

**Error-Handling:**
```typescript
interface PasteError {
  rowId: number;
  columnId: number;
  error: string;
  canRetry: boolean;
}

const handlePasteErrors = async (errors: PasteError[]) => {
  // Retry-Mechanismus für temporäre Fehler
  const retryableErrors = errors.filter(e => e.canRetry);
  if (retryableErrors.length > 0) {
    await retryFailedCells(retryableErrors);
  }
  
  // User-Benachrichtigung für permanente Fehler
  const permanentErrors = errors.filter(e => !e.canRetry);
  if (permanentErrors.length > 0) {
    showErrorDialog(permanentErrors);
  }
};
```

## Performance-Ziele

### Vorher vs. Nachher

| Datenmenge | Vorher | Nachher | Verbesserung |
|------------|--------|---------|--------------|
| 100 Zellen | 5-10s | 0.5-1s | 90%+ |
| 500 Zellen | 25-50s | 1-2s | 95%+ |
| 1000 Zellen | 50-100s | 2-4s | 96%+ |

### Technische Metriken

**API-Calls Reduktion:**
- Vorher: N Calls (N = Anzahl Zellen)
- Nachher: ceil(N / ChunkSize) Calls
- Beispiel 1000 Zellen: 1000 → 5-10 Calls (99% Reduktion)

**Database-Performance:**
- Bulk SQL-Updates statt einzelne INSERT/UPDATE
- Reduzierte Transaktion-Overhead
- Optimierte Index-Nutzung

**Network-Effizienz:**
- Weniger HTTP-Overhead
- Bessere Fehler-Aggregation
- Parallele Request-Verarbeitung

## Implementierungsreihenfolge

### Phase 1: Backend Bulk-API (2-3 Stunden)
1. Neuer `/api/tables/[id]/cells/bulk` Endpunkt
2. SQL-Optimierungen für Batch-Updates
3. Integration mit Formel-Engine
4. Tests für verschiedene Chunk-Größen

### Phase 2: Frontend Chunking (2-3 Stunden)  
1. Chunk-Strategie basierend auf Datenmenge
2. Optimistische UI-Updates
3. Parallel Chunk-Processing
4. Error-Handling und Retry-Logic

### Phase 3: UX-Verbesserungen (1-2 Stunden)
1. Progress-Tracking für große Datenmengen
2. Error-Dialoge und Recovery
3. Performance-Monitoring
4. A/B-Tests alte vs. neue Implementation

### Phase 4: Optimierungen (optional)
1. WebSocket für Real-time Progress
2. Background Jobs für sehr große Datenmengen
3. Client-side Caching für bessere Responsivität
4. Advanced Error Recovery

## Monitoring und Analytics

**Performance-Metriken:**
- Paste-Operation Durchschnittsdauer
- Erfolgsrate nach Datenmenge
- Chunk-Strategie Effizienz
- Database-Query-Performance

**Error-Tracking:**
- Fehlerrate nach Chunk-Größe
- Retry-Erfolgsrate
- User-Abbrüche bei langen Operationen

## Migration und Rollback

**Feature-Flag Implementierung:**
```typescript
const USE_CHUNKED_PASTE = process.env.FEATURE_CHUNKED_PASTE === 'true';

const handlePaste = USE_CHUNKED_PASTE 
  ? handlePasteOptimized 
  : handlePasteLegacy;
```

**Rollback-Plan:**
- Feature-Flag für sofortiges Deaktivieren
- Monitoring für Performance-Regression
- A/B-Testing für schrittweise Migration

## Risiken und Mitigation

**Potentielle Risiken:**
1. **Komplexität**: Neue Chunk-Logik könnte Bugs einführen
   - **Mitigation**: Umfangreiche Tests mit verschiedenen Datenmengen
   
2. **Memory-Usage**: Große Chunks könnten Memory-Issues verursachen
   - **Mitigation**: Adaptive Chunk-Größen basierend auf verfügbarem Memory
   
3. **Partial Failures**: Komplexeres Error-Handling
   - **Mitigation**: Robuste Rollback-Mechanismen und User-Feedback

**Überwachung:**
- Memory-Usage Monitoring
- Error-Rate Tracking
- User-Experience Metriken

## Fazit

Der Chunked Bulk-Update Ansatz bietet:
- ✅ 90%+ Performance-Verbesserung
- ✅ Bessere User-Experience
- ✅ Skalierbar für große Datenmengen
- ✅ Rückwärtskompatibel über Feature-Flags
- ✅ Implementierbar in 6-8 Stunden

Nächster Schritt: Wechsel in den Code-Modus zur Implementierung.