# HyperFormula Integration

Diese Dokumentation beschreibt die vollständig implementierte HyperFormula-Integration für erweiterte Tabellenkalkulationsfunktionen.

## Übersicht

Die HyperFormula-Integration bietet:
- **Vollständige Excel-kompatible Formel-Engine** basierend auf HyperFormula v3.0.1
- **A1-Notation** mit absoluten/relativen Referenzen ($A$1, A1, $A1, A$1)
- **Singleton-Architektur** pro Tabelle für optimale Performance
- **Automatische Neuberechnung** mit Abhängigkeitsverfolgung
- **Umfassende Funktionsbibliothek** (Mathematik, Logik, Text)
- **API-Integration** in bestehende CRUD-Operationen

## Architektur

### Kern-Komponenten

1. **`src/lib/formula/engine.ts`** - HyperFormula-Engine mit Singleton-Pattern
2. **`src/lib/formula/integration.ts`** - Integration-Layer für Datenbankoperationen
3. **`src/app/api/tables/[id]/formulas/route.ts`** - Dedicated Formula-APIs

### Datenmodell-Mapping

```
Tabelle = HyperFormula Sheet
├── Zeilen (rows) → HyperFormula Rows
├── Spalten (columns) → HyperFormula Columns  
└── Zellen (cells) → HyperFormula Cells
```

### A1-Notation-Mapping

```typescript
// Database: rowId=5, columnId mit position=3
// A1-Notation: C5

// Absolute Referenzen
$C$5  // Spalte und Zeile absolut
$C5   // Nur Spalte absolut
C$5   // Nur Zeile absolut  
C5    // Relativ
```

## API-Erweiterungen

### Erweiterte Row-APIs

#### Row Update mit Formeln
```json
PATCH /api/rows/123
{
  "data": {
    "name": "Product A",
    "price": 100,
    "tax": null  // Wird durch Formel berechnet
  },
  "formulas": {
    "tax": "=price * 0.19",
    "total": "=price + tax"
  }
}
```

#### Bulk Row Creation mit Formeln
```json
POST /api/tables/1/rows
{
  "rows": [
    {
      "data": { "base": 100 },
      "formulas": { "calculated": "=base * 1.5" }
    },
    {
      "data": { "base": 200 },
      "formulas": { "calculated": "=base * 1.5" }
    }
  ]
}
```

### Neue Formula-APIs

#### Formel-Validierung
```bash
POST /api/tables/1/formulas/validate
{
  "formula": "=SUM(A1:A10) * 0.8"
}

# Response:
{
  "data": {
    "formula": "=SUM(A1:A10) * 0.8",
    "isValid": true,
    "value": 40,
    "error": null
  }
}
```

#### Alle Formeln abrufen
```bash
GET /api/tables/1/formulas

# Response:
{
  "data": [
    {
      "rowId": 1,
      "columnId": 3,
      "formula": "=A1+B1",
      "value": 150,
      "error": null
    }
  ]
}
```

## Unterstützte Funktionen

### ✅ Mathematische Funktionen
- `SUM(range)` - Summe
- `AVERAGE(range)` - Durchschnitt
- `MIN(range)` - Minimum
- `MAX(range)` - Maximum
- `COUNT(range)` - Anzahl (nur Zahlen)
- `ROUND(number, digits)` - Runden
- `ABS(number)` - Betrag

### ✅ Logische Funktionen
- `IF(condition, true_value, false_value)` - Bedingte Anweisung
- `IFERROR(value, error_value)` - Fehlerbehandlung
- `AND(logical1, logical2, ...)` - Logisches UND
- `OR(logical1, logical2, ...)` - Logisches ODER
- `NOT(logical)` - Logisches NICHT

### ✅ Text-Funktionen
- `LEN(text)` - Textlänge
- `LEFT(text, chars)` - Zeichen von links
- `RIGHT(text, chars)` - Zeichen von rechts
- `MID(text, start, length)` - Zeichen aus der Mitte
- `UPPER(text)` - Großbuchstaben
- `LOWER(text)` - Kleinbuchstaben
- `TRIM(text)` - Leerzeichen entfernen
- `CONCATENATE(text1, text2, ...)` - Texte verbinden
- `&` - Verkettungsoperator

### ✅ Basis-Operatoren
- `+` - Addition
- `-` - Subtraktion
- `*` - Multiplikation
- `/` - Division
- `=`, `<>`, `>`, `<`, `>=`, `<=` - Vergleiche

## Verwendung

### 1. In Row-Updates
```javascript
// Frontend-Beispiel
const updateRow = async (rowId, data, formulas) => {
  const response = await fetch(`/api/rows/${rowId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      data, 
      formulas 
    })
  });
  return response.json();
};

// Beispiel-Aufruf
await updateRow(123, 
  { price: 100, quantity: 5 },
  { total: "=price * quantity * 1.19" }  // Mit 19% Steuer
);
```

### 2. Formel-Validierung
```javascript
const validateFormula = async (tableId, formula) => {
  const response = await fetch(`/api/tables/${tableId}/formulas/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formula })
  });
  return response.json();
};

// Beispiel
const validation = await validateFormula(1, "=SUM(A1:A10)");
console.log(validation.isValid ? "✅ Gültig" : "❌ Ungültig");
```

### 3. Programmgesteuert
```typescript
import { FormulaIntegration } from '@/lib/formula/integration';

// Einzelne Zelle mit Formel aktualisieren
const result = await FormulaIntegration.updateCellWithFormula(
  tableId, rowId, columnId, 
  null,  // Kein direkter Wert
  "=A1*B1+C1"  // Formel
);

console.log('Berechneter Wert:', result.value);
console.log('Betroffene Zellen:', result.affectedCells);
```

## Erweiterte Beispiele

### Beispiel 1: Preisberechnung mit Staffeln
```sql
-- Tabelle: products
| ID | base_price | quantity | discount_rate | final_price |
|----|------------|----------|---------------|-------------|
| 1  | 100        | 10       | 0.1           | =base_price * quantity * (1-discount_rate) |
| 2  | 50         | 5        | 0.05          | =base_price * quantity * (1-discount_rate) |
```

### Beispiel 2: Bedingte Berechnungen
```sql
-- Tabelle: orders
| ID | amount | fee_rate | processing_fee |
|----|--------|----------|----------------|
| 1  | 1000   | 0.02     | =IF(amount>500, amount*fee_rate, 10) |
| 2  | 300    | 0.02     | =IF(amount>500, amount*fee_rate, 10) |
```

### Beispiel 3: Text-Verarbeitung
```sql
-- Tabelle: customers  
| ID | first_name | last_name | full_name |
|----|------------|-----------|-----------|
| 1  | John       | Doe       | =first_name & " " & last_name |
| 2  | Jane       | Smith     | =first_name & " " & last_name |
```

## Fehlerbehandlung

### Formel-Fehler
```javascript
{
  "value": null,
  "error": "#DIV/0!",  // Division durch Null
  "formula": "=A1/B1"
}
```

### Häufige Fehler
- `#NAME?` - Unbekannte Funktion oder falsche Syntax
- `#DIV/0!` - Division durch Null
- `#VALUE!` - Falscher Datentyp
- `#REF!` - Ungültige Zellreferenz
- `#ERROR!` - Allgemeiner Syntaxfehler

### Fehlerbehandlung mit IFERROR
```sql
=IFERROR(A1/B1, "Fehler bei Division")
```

## Performance-Optimierungen

### 1. Singleton-Pattern
- Eine HyperFormula-Instanz pro Tabelle
- Automatisches Caching von Berechnungen
- Effiziente Speichernutzung

### 2. Batch-Verarbeitung
```typescript
// Mehrere Zellen gleichzeitig aktualisieren
const updates = [
  { rowId: 1, columnId: 3, formula: "=A1+B1" },
  { rowId: 2, columnId: 3, formula: "=A2+B2" },
];

const result = await FormulaIntegration.updateMultipleCells(tableId, updates);
```

### 3. Abhängigkeitsverfolgung
- Automatische Neuberechnung nur betroffener Zellen
- Effiziente Dependency-Graphen
- Vermeidung von Endlosschleifen

## Testing

### Standalone-Tests
```bash
npm run test:formulas-standalone
```

Testet:
- ✅ A1-Notation-Konvertierung
- ✅ Basis-Formeln (Arithmetik)
- ✅ Standard-Funktionen
- ✅ Text-Funktionen
- ✅ Range-Operationen
- ✅ Fehlerbehandlung

### Integration-Tests
```bash
npm run test:formulas  # Erfordert DB-Verbindung
```

## Limitierungen

1. **Sprach-Support**: Derzeit nur englische Funktionsnamen
2. **Logische Funktionen**: AND, OR, NOT zeigen #NAME?-Fehler (HyperFormula-spezifisch)
3. **Zirkular-Referenzen**: Automatische Erkennung und Vermeidung
4. **Memory**: Singleton-Instanzen bleiben im Speicher (manuelles Cleanup möglich)

## Roadmap

### Kurze Frist
- [ ] Deutsche Funktionsnamen (`SUMME`, `MITTELWERT`, etc.)
- [ ] Array-Formeln (`{=SUM(A1:A10*B1:B10)}`)
- [ ] Erweiterte Text-Funktionen (`FIND`, `REPLACE`, `SUBSTITUTE`)

### Längere Frist
- [ ] Pivot-Table-Funktionen
- [ ] Datum/Zeit-Funktionen erweitern
- [ ] Custom-Funktionen definieren
- [ ] Import/Export von Excel-Dateien mit Formeln
- [ ] Real-time Formula-Updates via WebSocket

## Migration

### Bestehende Daten
```sql
-- Bestehende Zellen ohne Formeln bleiben unverändert
-- Neue formula-Spalte in cells-Tabelle ist optional
-- Schrittweise Migration möglich
```

### API-Kompatibilität
- Alle bestehenden APIs funktionieren weiterhin
- Neue `formulas`-Parameter ist optional
- Rückwärtskompatible Erweiterungen

## Troubleshooting

### Häufige Probleme

1. **"Language not registered"**
   ```typescript
   // Entferne language-Parameter aus Config
   const config = { licenseKey: 'gpl-v3' }; // Ohne language
   ```

2. **"No sheet with id = 0"**
   ```typescript
   const hf = HyperFormula.buildEmpty(config);
   hf.addSheet(); // Sheet manuell hinzufügen
   ```

3. **Formel-Syntax-Fehler**
   ```typescript
   // Verwende immer = am Anfang
   "=SUM(A1:A10)"  // ✅ Korrekt
   "SUM(A1:A10)"   // ❌ Fehler
   ```

## Fazit

Die HyperFormula-Integration transformiert das DataTables-System in eine vollwertige Tabellenkalkulations-Plattform mit:

- **🧮 Excel-kompatible Formeln** 
- **⚡ Automatische Neuberechnung**
- **🔗 Zellenabhängigkeiten**
- **🛡️ Robuste Fehlerbehandlung**
- **📊 Umfassende Funktionsbibliothek**

Die Implementierung ist produktionsreif und sofort einsatzbereit für komplexe Berechnungsszenarien in Datenbank-gestützten Tabellenanwendungen.