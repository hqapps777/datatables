'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  MoreVertical,
  Plus,
  Edit,
  Copy,
  Archive,
  Share2,
  Download,
  Trash,
  Eye,
  Calendar,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

interface TableData {
  id: number;
  name: string;
  description: string;
  folderId: number;
  rowCount: number;
  columnCount: number;
  isArchived: boolean;
  updatedAt: string;
  createdAt: string;
}

interface TableListProps {
  tables: TableData[];
  folderId?: number;
  onCreateTable?: (folderId: number) => void;
  onEditTable?: (tableId: number) => void;
  onDeleteTable?: (tableId: number) => void;
  onArchiveTable?: (tableId: number) => void;
  onDuplicateTable?: (tableId: number) => void;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = (now.getTime() - date.getTime()) / 1000;
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(dateString);
};

export function TableList({
  tables,
  folderId,
  onCreateTable,
  onEditTable,
  onDeleteTable,
  onArchiveTable,
  onDuplicateTable,
}: TableListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const activeTables = tables.filter(table => !table.isArchived);

  if (activeTables.length === 0) {
    return (
      <div className="text-center py-12">
        <Table className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold mb-2">No tables yet</h3>
        <p className="text-muted-foreground mb-4">
          Create your first table to start organizing your data.
        </p>
        {folderId && onCreateTable && (
          <Button onClick={() => onCreateTable(folderId)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Table
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tables</h3>
          <p className="text-sm text-muted-foreground">
            {activeTables.length} table{activeTables.length !== 1 ? 's' : ''}
          </p>
        </div>
        {folderId && onCreateTable && (
          <Button onClick={() => onCreateTable(folderId)}>
            <Plus className="h-4 w-4 mr-2" />
            New Table
          </Button>
        )}
      </div>

      {/* Table Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeTables.map((table) => (
          <Card key={table.id} className="group hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Table className="h-5 w-5 text-blue-600" />
                  <Badge variant="secondary" className="text-xs">
                    Data
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/tables/${table.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Table
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEditTable?.(table.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicateTable?.(table.id)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onArchiveTable?.(table.id)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteTable?.(table.id)}
                      className="text-destructive"
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardTitle className="text-base">{table.name}</CardTitle>
              <CardDescription className="text-sm">
                {table.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold">{table.rowCount}</div>
                  <div className="text-xs text-muted-foreground">Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{table.columnCount}</div>
                  <div className="text-xs text-muted-foreground">Columns</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  Updated {getTimeAgo(table.updatedAt)}
                </div>
              </div>

              <Button asChild className="w-full" size="sm">
                <Link href={`/dashboard/tables/${table.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Open Table
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Mock data for testing
export const mockTables: TableData[] = [
  {
    id: 1,
    name: 'Customer Database',
    description: 'Main customer information and contact details',
    folderId: 2,
    rowCount: 1247,
    columnCount: 8,
    isArchived: false,
    updatedAt: '2024-02-15T10:30:00Z',
    createdAt: '2024-01-15T09:00:00Z',
  },
  {
    id: 2,
    name: 'Product Catalog',
    description: 'Complete product inventory and specifications',
    folderId: 2,
    rowCount: 856,
    columnCount: 12,
    isArchived: false,
    updatedAt: '2024-02-14T14:20:00Z',
    createdAt: '2024-01-20T11:30:00Z',
  },
  {
    id: 3,
    name: 'Sales Analytics',
    description: 'Monthly sales data and performance metrics',
    folderId: 5,
    rowCount: 324,
    columnCount: 6,
    isArchived: false,
    updatedAt: '2024-02-13T16:45:00Z',
    createdAt: '2024-02-01T08:15:00Z',
  },
];