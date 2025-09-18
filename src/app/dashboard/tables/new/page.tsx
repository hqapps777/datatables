'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { 
  Plus, 
  ArrowLeft,
  Database,
  FolderOpen,
  Lock,
  Globe,
  Trash2,
  GripVertical
} from 'lucide-react';

interface Column {
  id: string;
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export default function NewTablePage() {
  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [folder, setFolder] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [columns, setColumns] = useState<Column[]>([
    { id: '1', name: 'Name', type: 'text', required: true, description: 'Full name' },
    { id: '2', name: 'Email', type: 'email', required: true, description: 'Email address' }
  ]);

  const addColumn = () => {
    const newColumn: Column = {
      id: Date.now().toString(),
      name: '',
      type: 'text',
      required: false,
      description: ''
    };
    setColumns([...columns, newColumn]);
  };

  const removeColumn = (id: string) => {
    setColumns(columns.filter(col => col.id !== id));
  };

  const updateColumn = (id: string, field: keyof Column, value: string | boolean) => {
    setColumns(columns.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  };

  const columnTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Yes/No' },
    { value: 'url', label: 'URL' },
    { value: 'phone', label: 'Phone' },
    { value: 'currency', label: 'Currency' }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/tables">Tables</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>New Table</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Create New Table</h1>
            <p className="text-muted-foreground">
              Set up your table structure and define columns for your data.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/dashboard/tables">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tables
            </a>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Provide basic details about your table.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tableName">Table Name</Label>
                  <Input
                    id="tableName"
                    placeholder="e.g., Customer Database"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this table is used for..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Workspace</Label>
                    <Select value={workspace} onValueChange={setWorkspace}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="my-workspace">My Workspace</SelectItem>
                        <SelectItem value="team-workspace">Team Workspace</SelectItem>
                        <SelectItem value="shared-workspace">Shared Workspace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Folder (Optional)</Label>
                    <Select value={folder} onValueChange={setFolder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="projects">Projects</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                        <SelectItem value="reports">Reports</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Column Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Column Configuration</CardTitle>
                    <CardDescription>
                      Define the structure of your table columns.
                    </CardDescription>
                  </div>
                  <Button onClick={addColumn} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Column
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {columns.map((column, index) => (
                    <div key={column.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                          <span className="text-sm font-medium">Column {index + 1}</span>
                        </div>
                        {columns.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeColumn(column.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Column Name</Label>
                          <Input
                            placeholder="e.g., Full Name"
                            value={column.name}
                            onChange={(e) => updateColumn(column.id, 'name', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Data Type</Label>
                          <Select
                            value={column.type}
                            onValueChange={(value) => updateColumn(column.id, 'type', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {columnTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Input
                          placeholder="Describe this column..."
                          value={column.description}
                          onChange={(e) => updateColumn(column.id, 'description', e.target.value)}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`required-${column.id}`}
                          checked={column.required}
                          onChange={(e) => updateColumn(column.id, 'required', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`required-${column.id}`} className="text-sm">
                          Required field
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-6">
            {/* Privacy Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Sharing</CardTitle>
                <CardDescription>
                  Control who can access this table.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="private"
                      name="visibility"
                      value="private"
                      checked={visibility === 'private'}
                      onChange={(e) => setVisibility(e.target.value)}
                    />
                    <Label htmlFor="private" className="flex items-center space-x-2 cursor-pointer">
                      <Lock className="h-4 w-4" />
                      <span>Private</span>
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Only you and invited collaborators can access
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="public"
                      name="visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={(e) => setVisibility(e.target.value)}
                    />
                    <Label htmlFor="public" className="flex items-center space-x-2 cursor-pointer">
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Anyone with the link can view
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Columns:</span>
                  <span className="ml-2 font-medium">{columns.length}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Visibility:</span>
                  <Badge variant={visibility === 'public' ? 'default' : 'secondary'} className="ml-2">
                    {visibility === 'public' ? (
                      <Globe className="h-3 w-3 mr-1" />
                    ) : (
                      <Lock className="h-3 w-3 mr-1" />
                    )}
                    {visibility}
                  </Badge>
                </div>
                {workspace && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Workspace:</span>
                    <span className="ml-2 font-medium">{workspace}</span>
                  </div>
                )}
                {folder && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Folder:</span>
                    <span className="ml-2 font-medium">{folder}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button className="w-full" size="lg">
                <Database className="h-4 w-4 mr-2" />
                Create Table
              </Button>
              <Button variant="outline" className="w-full">
                Save as Draft
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}