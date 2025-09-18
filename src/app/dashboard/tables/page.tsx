'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Filter,
  MoreHorizontal,
  Calendar,
  Users,
  Lock,
  Globe,
  FileText,
  BarChart3,
  Edit,
  Copy,
  Share,
  Trash2,
  ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock data for tables
const tables = [
  {
    id: 1,
    name: 'Customer Database',
    description: 'Customer information and contact details',
    workspace: 'My Workspace',
    folder: 'Projects',
    rows: 1247,
    columns: 12,
    lastModified: '2 hours ago',
    shared: true,
    visibility: 'private',
    collaborators: 3
  },
  {
    id: 2,
    name: 'Product Inventory',
    description: 'Current stock levels and product information',
    workspace: 'My Workspace',
    folder: 'Operations',
    rows: 856,
    columns: 8,
    lastModified: '1 day ago',
    shared: false,
    visibility: 'public',
    collaborators: 1
  },
  {
    id: 3,
    name: 'Sales Analytics',
    description: 'Monthly sales performance data',
    workspace: 'Sales Team',
    folder: 'Reports',
    rows: 2341,
    columns: 15,
    lastModified: '3 days ago',
    shared: true,
    visibility: 'private',
    collaborators: 5
  },
  {
    id: 4,
    name: 'Employee Records',
    description: 'HR database with employee information',
    workspace: 'HR Department',
    folder: 'Personnel',
    rows: 128,
    columns: 20,
    lastModified: '1 week ago',
    shared: false,
    visibility: 'private',
    collaborators: 2
  }
];

export default function TablesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleEdit = (tableId: number) => {
    // Navigate to table edit page
    window.location.href = `/dashboard/tables/${tableId}/edit`;
  };

  const handleDuplicate = (tableId: number, tableName: string) => {
    alert(`Duplicating table: ${tableName} (ID: ${tableId})`);
    // In a real app, this would duplicate the table
  };

  const handleShare = (tableId: number, tableName: string) => {
    alert(`Sharing table: ${tableName} (ID: ${tableId})`);
    // In a real app, this would open a share dialog
  };

  const handleDelete = (tableId: number, tableName: string) => {
    if (confirm(`Are you sure you want to delete "${tableName}"? This action cannot be undone.`)) {
      alert(`Deleting table: ${tableName} (ID: ${tableId})`);
      // In a real app, this would delete the table
    }
  };

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Tables</h1>
            <p className="text-muted-foreground mt-2">
              Manage and organize all your data tables across workspaces.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/tables/new">
              <Plus className="h-4 w-4 mr-2" />
              New Table
            </Link>
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        {/* Tables Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTables.map((table) => (
            <Card key={table.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Link href={`/dashboard/tables/${table.id}`} className="space-y-1 flex-1">
                    <CardTitle className="text-base hover:text-blue-600 transition-colors cursor-pointer">
                      {table.name}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {table.description}
                    </CardDescription>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-8 h-8 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/tables/${table.id}`}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Table
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(table.id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(table.id, table.name)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleShare(table.id, table.name)}>
                        <Share className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => handleDelete(table.id, table.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* Table Stats */}
                <div className="flex items-center space-x-4 pt-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <FileText className="h-3 w-3 mr-1" />
                    {table.rows.toLocaleString()} rows
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <BarChart3 className="h-3 w-3 mr-1" />
                    {table.columns} columns
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Workspace and Folder */}
                  <div className="text-xs text-muted-foreground">
                    {table.workspace} / {table.folder}
                  </div>
                  
                  {/* Badges */}
                  <div className="flex items-center space-x-2">
                    <Badge variant={table.visibility === 'public' ? 'default' : 'secondary'}>
                      {table.visibility === 'public' ? (
                        <Globe className="h-3 w-3 mr-1" />
                      ) : (
                        <Lock className="h-3 w-3 mr-1" />
                      )}
                      {table.visibility}
                    </Badge>
                    {table.shared && (
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {table.collaborators} collaborators
                      </Badge>
                    )}
                  </div>
                  
                  {/* Last Modified */}
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    Updated {table.lastModified}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredTables.length === 0 && (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {searchQuery ? 'No tables found' : 'No tables yet'}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery 
                    ? `No tables match your search "${searchQuery}"`
                    : 'Create your first table to get started with organizing your data.'
                  }
                </p>
              </div>
              {!searchQuery && (
                <Button asChild>
                  <Link href="/dashboard/tables/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Table
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}