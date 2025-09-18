# DataTables API Documentation

Diese Dokumentation beschreibt die vollständig implementierten APIs für Spalten und Zeilen mit erweiterten Funktionen wie Filterung, Sortierung, Paginierung und Audit-Logging.

## Übersicht

### Implementierte APIs

#### Spalten (Columns)
- `GET /api/tables/:id/columns` - Alle Spalten einer Tabelle abrufen
- `POST /api/tables/:id/columns` - Neue Spalte erstellen
- `PATCH /api/columns/:id` - Spalte bearbeiten
- `DELETE /api/columns/:id` - Spalte löschen

#### Zeilen (Rows)
- `GET /api/tables/:id/rows` - Zeilen mit Filterung, Sortierung und Paginierung abrufen
- `POST /api/tables/:id/rows` - Neue Zeile(n) erstellen (einzeln oder bulk)
- `PATCH /api/rows/:id` - Zeile bearbeiten
- `DELETE /api/rows/:id` - Zeile löschen

## API-Endpunkte Details

### Spalten APIs

#### GET /api/tables/:id/columns
Ruft alle Spalten einer Tabelle ab.

**Parameter:**
- `id` (path): Tabellen-ID

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "column_name",
      "type": "text",
      "config": { "required": false },
      "position": 1,
      "isComputed": false,
      "formula": null
    }
  ],
  "metadata": {
    "total": 5
  }
}
```

#### POST /api/tables/:id/columns
Erstellt eine neue Spalte.

**Body:**
```json
{
  "name": "new_column",
  "type": "text|number|boolean|date|email|url|json",
  "config": {
    "required": false,
    "defaultValue": null,
    "validation": {
      "min": 0,
      "max": 100,
      "pattern": "^[A-Za-z]+$"
    }
  },
  "position": 1
}
```

#### PATCH /api/columns/:id
Bearbeitet eine existierende Spalte.

**Body:**
```json
{
  "name": "updated_name",
  "type": "text",
  "config": { "required": true },
  "position": 2
}
```

#### DELETE /api/columns/:id
Löscht eine Spalte und alle zugehörigen Zellen.

### Zeilen APIs

#### GET /api/tables/:id/rows
Ruft Zeilen mit erweiterten Filterungs- und Sortierfunktionen ab.

**Query Parameter:**

**Filterung:**
- `filter[column_name]=operator:value`
- Operatoren: `=`, `!=`, `contains`, `>`, `<`, `>=`, `<=`, `is_null`, `is_not_null`
- Beispiele:
  - `filter[name]=contains:test`
  - `filter[age]=>=:18`
  - `filter[status]=!=:inactive`

**Sortierung:**
- `sort=column1,-column2` (- für DESC, + oder ohne für ASC)
- Beispiele:
  - `sort=name` (aufsteigend)
  - `sort=-created_at` (absteigend)
  - `sort=name,-created_at` (mehrere Spalten)

**Paginierung:**
- `page=1` (Standard: 1)
- `pageSize=10` (Standard: 10, Max: 100)

**Vollständige Beispiel-URL:**
```
GET /api/tables/1/rows?filter[name]=contains:john&filter[age]=>=:18&sort=-created_at&page=1&pageSize=20
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-01T10:00:00Z",
      "data": {
        "name": "John Doe",
        "age": 25,
        "email": "john@example.com"
      }
    }
  ],
  "metadata": {
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

#### POST /api/tables/:id/rows
Erstellt neue Zeile(n).

**Einzelne Zeile:**
```json
{
  "data": {
    "name": "John Doe",
    "age": 25,
    "email": "john@example.com"
  }
}
```

**Bulk Creation:**
```json
{
  "rows": [
    {
      "data": {
        "name": "John Doe",
        "age": 25
      }
    },
    {
      "data": {
        "name": "Jane Smith", 
        "age": 30
      }
    }
  ]
}
```

#### PATCH /api/rows/:id
Bearbeitet eine existierende Zeile.

**Body:**
```json
{
  "data": {
    "name": "Updated Name",
    "age": 26
  }
}
```

#### DELETE /api/rows/:id
Löscht eine Zeile (Soft Delete - setzt `deletedAt` Timestamp).

## Erweiterte Funktionen

### 1. Serverseite Filterung

Unterstützte Operatoren je nach Spaltentyp:

**Text:**
- `=`, `!=`, `contains`, `is_null`, `is_not_null`

**Number:**
- `=`, `!=`, `>`, `<`, `>=`, `<=`, `is_null`, `is_not_null`

**Boolean:**
- `=`, `!=`, `is_null`, `is_not_null`

**Date:**
- `=`, `!=`, `>`, `<`, `>=`, `<=`, `is_null`, `is_not_null`

### 2. Sortierung

- Mehrfache Sortierung möglich
- ASC/DESC pro Spalte
- Unterstützt alle Spaltentypen

### 3. Paginierung

- Standard: 10 Elemente pro Seite
- Maximum: 100 Elemente pro Seite  
- Liefert Metadaten für Frontend-Pagination

### 4. Audit-Logging

Automatisches Logging aller Änderungen:
- Spalten-Erstellung/Update/Löschung
- Zeilen-Erstellung/Update/Löschung (inkl. Bulk)
- Diff-basierte Änderungsverfolgung
- User-ID und Timestamp-Tracking

### 5. Validierung

**Spaltentyp-Validierung:**
- `text`: String, Längenvalidierung, Regex-Pattern
- `number`: Numerische Werte, Min/Max-Validierung
- `boolean`: true/false Werte
- `date`: ISO-Datumsformat
- `email`: E-Mail-Format-Validierung
- `url`: URL-Format-Validierung
- `json`: Valides JSON

**Request-Validierung:**
- Zod-basierte Schema-Validierung
- Detaillierte Fehlermeldungen
- Field-spezifische Fehler

### 6. Fehlerbehandlung

Strukturierte Fehlerantworten:
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "name",
      "message": "Column name is required"
    }
  ]
}
```

HTTP-Status-Codes:
- `400` - Bad Request (Validierungsfehler)
- `401` - Unauthorized (Authentifizierung erforderlich)
- `403` - Forbidden (Keine Berechtigung)
- `404` - Not Found (Ressource nicht gefunden)
- `409` - Conflict (z.B. Spaltenname bereits vorhanden)
- `500` - Internal Server Error

### 7. Authentifizierung & Autorisierung

Unterstützte Authentifizierungstypen:
- JWT Token
- API Keys
- Public Slug Access (nur für View-Permission)

Berechtigungen:
- `view` - Lesen von Daten
- `edit` - Erstellen/Bearbeiten von Daten
- `manage` - Vollzugriff inkl. Löschen

## Testing

Zum Testen der APIs:

```bash
npm run test:api
```

Dieses Skript führt automatisierte Tests für alle Endpunkte durch und validiert:
- Korrekte HTTP-Status-Codes
- Response-Strukturen  
- Validierungsfehler
- Authentifizierung

## Schema

Die APIs nutzen das bestehende Datenbankschema:
- `tables` - Tabellen-Metadaten
- `columns` - Spalten-Definitionen mit Typ und Config
- `rows` - Zeilen-Metadaten (Timestamps)
- `cells` - Tatsächliche Daten (JSON-serialisiert)
- `audits` - Änderungsprotokoll

## Performance-Optimierungen

- Datenbankindizes für häufige Abfragen
- Paginierung zum Vermeiden großer Resultsets
- Lazy Loading von Zell-Daten
- Effiziente Filter-Queries mit Drizzle ORM
- Batch-Operationen für Bulk-Aktionen

## Nächste Schritte

Mögliche Erweiterungen:
- Volltext-Suche
- Komplexere Filter-Operatoren (IN, BETWEEN)
- Export/Import-Funktionen
- Real-time Updates via WebSocket
- Caching-Layer für bessere Performance
- GraphQL-Alternative