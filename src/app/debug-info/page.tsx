'use client';

import { useState, useEffect } from 'react';

export default function DebugInfo() {
  const [info, setInfo] = useState<any>({});

  useEffect(() => {
    // Check localStorage
    const storageKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes('table-')) {
        storageKeys.push({
          key,
          value: localStorage.getItem(key)?.substring(0, 100) + '...'
        });
      }
    }

    // Get current mock data from page
    import('../dashboard/tables/[id]/page').then(module => {
      setInfo({
        timestamp: new Date().toISOString(),
        storageKeys,
        location: window.location.href,
        userAgent: navigator.userAgent.substring(0, 100),
        screen: `${screen.width}x${screen.height}`,
        localStorage: storageKeys.length,
        hasUndoButton: !!document.querySelector('[title*="Rückgängig"]'),
        version: 'DEBUG_VERSION_2024_09_24'
      });
    });
  }, []);

  const clearStorage = () => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.includes('table-')) {
        localStorage.removeItem(key);
        console.log('Removed:', key);
      }
    }
    window.location.reload();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🐛 Debug Information</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold">System Info</h2>
          <pre className="text-sm mt-2">{JSON.stringify(info, null, 2)}</pre>
        </div>

        <div className="flex space-x-4">
          <button 
            onClick={clearStorage}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            🧹 Clear localStorage & Reload
          </button>
          
          <a 
            href="/dashboard/tables/1" 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block"
          >
            📊 Go to Table
          </a>
        </div>

        <div className="bg-yellow-100 p-4 rounded">
          <h3 className="font-semibold">Expected Mock Data (Current Version):</h3>
          <ul className="text-sm mt-2 list-disc pl-5">
            <li>John Doe, Jane Smith, Bob Johnson, Alice Brown</li>
            <li>Status: Active, Inactive, Pending</li>
            <li>Undo button should be visible in table header</li>
            <li>Version: DEBUG_VERSION_2024_09_24</li>
          </ul>
        </div>
      </div>
    </div>
  );
}