'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Undo2, Copy, Clipboard } from 'lucide-react';

export default function DebugUndoPage() {
  const [undoHistory, setUndoHistory] = useState<any[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});
  const [copiedData, setCopiedData] = useState<string>('');

  useEffect(() => {
    setCanUndo(undoHistory.length > 0);
  }, [undoHistory]);

  // Simulate adding undo history
  const addTestHistory = () => {
    const testAction = {
      type: 'cell_update',
      timestamp: Date.now(),
      data: {
        rowId: 1,
        columnId: 1,
        oldValue: 'original',
        newValue: 'changed',
        oldFormula: null
      },
      description: 'Test Cell Edit'
    };
    setUndoHistory(prev => [...prev, testAction]);
  };

  // Simulate undo
  const performUndo = () => {
    if (undoHistory.length === 0) return;
    
    const lastAction = undoHistory[undoHistory.length - 1];
    console.log('🔄 Performing undo:', lastAction);
    
    setUndoHistory(prev => prev.slice(0, -1));
  };

  // Test copy functionality
  const testCopy = async () => {
    try {
      const testData = 'Test Copy Data: ' + new Date().toISOString();
      await navigator.clipboard.writeText(testData);
      setCopiedData(testData);
      console.log('✅ Copy successful:', testData);
    } catch (error) {
      console.error('❌ Copy failed:', error);
    }
  };

  // Test paste functionality
  const testPaste = async () => {
    try {
      const clipboardData = await navigator.clipboard.readText();
      console.log('📋 Clipboard data:', clipboardData);
      setDebugInfo(prev => ({ ...prev, clipboardData }));
    } catch (error) {
      console.error('❌ Paste failed:', error);
      setDebugInfo(prev => ({ ...prev, clipboardError: error instanceof Error ? error.message : String(error) }));
    }
  };

  // Check localStorage data
  const checkLocalStorage = () => {
    const storageData: any = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('table-')) {
        try {
          storageData[key] = JSON.parse(localStorage.getItem(key) || '{}');
        } catch {
          storageData[key] = localStorage.getItem(key);
        }
      }
    }
    setDebugInfo(prev => ({ ...prev, localStorage: storageData }));
  };

  // Test keyboard events with comprehensive debugging
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('🎹 KEYDOWN EVENT:', {
        key: event.key,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        target: event.target,
        timestamp: Date.now()
      });

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
      
      console.log('🔍 KEY ANALYSIS:', {
        isMac,
        shouldUseMetaKey: isMac,
        shouldUseCtrlKey: !isMac,
        ctrlKeyPressed: event.ctrlKey,
        metaKeyPressed: event.metaKey,
        effectiveCtrlKey: ctrlKey
      });
      
      if (ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        console.log('🚨 UNDO SHORTCUT DETECTED!', {
          historyLength: undoHistory.length,
          canUndo,
          willAddHistory: undoHistory.length === 0
        });
        
        if (undoHistory.length > 0) {
          console.log('🔄 Performing undo...');
          performUndo();
        } else {
          console.log('➕ Adding test history first...');
          addTestHistory();
        }
      }
      
      if (ctrlKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        console.log('📋 COPY SHORTCUT DETECTED!');
        testCopy();
      }
      
      if (ctrlKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        console.log('📄 PASTE SHORTCUT DETECTED!');
        testPaste();
      }
    };

    console.log('🎹 Registering keyboard event listener');
    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => {
      console.log('🎹 Removing keyboard event listener');
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [undoHistory, canUndo]);

  useEffect(() => {
    checkLocalStorage();
  }, []);

  return (
    <div className="container mx-auto p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🔄 Undo/Redo Funktions-Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Undo Button Test */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Undo Button Test</h3>
            
            <div className="flex items-center space-x-4">
              {/* Original Button Style */}
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
                    console.log('⚠️ No undo history available, creating test entry');
                    addTestHistory();
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
              
              <div className="text-sm">
                <div>Status: {canUndo ? '✅ Aktiv' : '❌ Deaktiviert'}</div>
                <div>History: {undoHistory.length} Einträge</div>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button onClick={addTestHistory} size="sm">
                Test-History hinzufügen
              </Button>
              <Button onClick={() => setUndoHistory([])} size="sm" variant="outline">
                History löschen
              </Button>
            </div>
          </div>

          {/* Copy/Paste Test */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Copy/Paste Test</h3>
            
            <div className="flex items-center space-x-4">
              <Button onClick={testCopy} size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Test Copy
              </Button>
              <Button onClick={testPaste} size="sm">
                <Clipboard className="h-4 w-4 mr-2" />
                Test Paste
              </Button>
            </div>
            
            {copiedData && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                <strong>Kopiert:</strong> {copiedData}
              </div>
            )}
          </div>

          {/* Keyboard Test */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Tastatur-Test</h3>
            <div className="text-sm text-gray-600">
              <p><kbd>Ctrl+Z</kbd> / <kbd>Cmd+Z</kbd>: Undo</p>
              <p><kbd>Ctrl+C</kbd> / <kbd>Cmd+C</kbd>: Copy</p>
              <p><kbd>Ctrl+V</kbd> / <kbd>Cmd+V</kbd>: Paste</p>
            </div>
          </div>

          {/* History Display */}
          {undoHistory.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Undo History</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {undoHistory.map((action, index) => (
                  <div key={index} className="p-2 bg-gray-50 border rounded text-xs">
                    <div><strong>Type:</strong> {action.type}</div>
                    <div><strong>Description:</strong> {action.description}</div>
                    <div><strong>Time:</strong> {new Date(action.timestamp).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug Info */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Debug Information</h3>
            <pre className="p-4 bg-gray-100 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify({
                undoHistoryLength: undoHistory.length,
                canUndo,
                hasClipboardAPI: !!navigator.clipboard,
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                ...debugInfo
              }, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}