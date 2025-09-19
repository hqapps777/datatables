'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RefreshCw, Clock, Zap, AlertCircle, CheckCircle } from 'lucide-react';

interface RecalcStats {
  tableId: number;
  tableName: string;
  totalFormulaCells: number;
  volatileCells: number;
  lastCalcVersion: number;
  volatileFunctionTypes: Array<{
    function: string;
    count: number;
  }>;
  timestamp: string;
}

interface RecalcModeToggleProps {
  tableId: number;
  onModeChange?: (isAuto: boolean) => void;
  className?: string;
}

export function RecalcModeToggle({ 
  tableId, 
  onModeChange,
  className = ""
}: RecalcModeToggleProps) {
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [stats, setStats] = useState<RecalcStats | null>(null);
  const [lastRecalc, setLastRecalc] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load initial stats and mode
  useEffect(() => {
    loadRecalcStats();
    
    // Load saved mode from localStorage
    const savedMode = localStorage.getItem(`recalc-mode-${tableId}`);
    if (savedMode) {
      setIsAutoMode(savedMode === 'auto');
    }
  }, [tableId]);

  // Save mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`recalc-mode-${tableId}`, isAutoMode ? 'auto' : 'manual');
    onModeChange?.(isAutoMode);
  }, [isAutoMode, tableId, onModeChange]);

  const loadRecalcStats = async () => {
    try {
      const response = await fetch(`/api/tables/${tableId}/recalc`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setError(null);
      } else {
        setError(data.error || 'Failed to load recalc stats');
      }
    } catch (err) {
      setError('Failed to connect to recalc endpoint');
      console.error('Failed to load recalc stats:', err);
    }
  };

  const handleManualRecalc = async (forceRecalc = false) => {
    setIsRecalculating(true);
    setError(null);

    try {
      const response = await fetch(`/api/tables/${tableId}/recalc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceRecalc,
          includeVolatile: true,
          maxCells: 1000,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setLastRecalc(new Date());
        setError(null);
        
        // Refresh stats after recalculation
        await loadRecalcStats();
        
        // Show success feedback
        console.log(`Recalculation completed: ${data.summary.changedCells} cells updated`);
      } else {
        setError(data.error || 'Recalculation failed');
      }
    } catch (err) {
      setError('Failed to trigger recalculation');
      console.error('Manual recalc failed:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const getModeDescription = () => {
    if (isAutoMode) {
      return "Formulas recalculate automatically when dependencies change";
    } else {
      return "Formulas only recalculate when manually triggered";
    }
  };

  const getVolatileBadgeVariant = (count: number) => {
    if (count === 0) return "secondary";
    if (count <= 5) return "default";
    if (count <= 20) return "secondary";
    return "destructive";
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Formula Recalculation
            </CardTitle>
            <CardDescription>
              {getModeDescription()}
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="recalc-mode" className="text-sm font-medium">
              Mode:
            </Label>
            <Button
              variant={isAutoMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAutoMode(true)}
            >
              Auto
            </Button>
            <Button
              variant={!isAutoMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAutoMode(false)}
            >
              Manual
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Formula Cells</div>
              <div className="font-medium">{stats.totalFormulaCells}</div>
            </div>
            
            <div>
              <div className="text-muted-foreground">Volatile Functions</div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{stats.volatileCells}</span>
                <Badge variant={getVolatileBadgeVariant(stats.volatileCells)} className="text-xs">
                  {stats.volatileCells === 0 ? 'None' : 
                   stats.volatileCells <= 5 ? 'Few' :
                   stats.volatileCells <= 20 ? 'Some' : 'Many'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {stats && stats.volatileFunctionTypes.length > 0 && (
          <div>
            <div className="text-sm text-muted-foreground mb-2">Volatile Functions Used:</div>
            <div className="flex flex-wrap gap-2">
              {stats.volatileFunctionTypes.map((type) => (
                <Badge key={type.function} variant="outline" className="text-xs">
                  {type.function.replace('()', '')} ({type.count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        <hr className="border-t border-border" />

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">Manual Actions</div>
            {lastRecalc && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Last recalc: {lastRecalc.toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManualRecalc(false)}
              disabled={isRecalculating}
            >
              {isRecalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Recalculating...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-1" />
                  Recalc Volatile
                </>
              )}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => handleManualRecalc(true)}
              disabled={isRecalculating}
            >
              {isRecalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Recalculating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Force Recalc All
                </>
              )}
            </Button>
          </div>
        </div>

        {!isAutoMode && stats && stats.volatileCells > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Manual Mode Active:</strong> Volatile functions like NOW() and TODAY() 
              won't update automatically. Use "Recalc Volatile" to refresh time-based formulas.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}