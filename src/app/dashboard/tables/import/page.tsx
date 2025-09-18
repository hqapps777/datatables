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
  Upload,
  FileText,
  ArrowLeft,
  Check,
  X,
  Database,
  Download,
  AlertCircle
} from 'lucide-react';

export default function ImportTablePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [folder, setFolder] = useState('');
  const [importStep, setImportStep] = useState(1);
  const [previewData, setPreviewData] = useState<any[]>([]);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTableName(file.name.replace(/\.[^/.]+$/, ""));
      
      // Mock preview data - in real app, this would parse the actual file
      setPreviewData([
        { 'Name': 'John Doe', 'Email': 'john@example.com', 'Phone': '+1234567890', 'City': 'New York' },
        { 'Name': 'Jane Smith', 'Email': 'jane@example.com', 'Phone': '+0987654321', 'City': 'Los Angeles' },
        { 'Name': 'Bob Johnson', 'Email': 'bob@example.com', 'Phone': '+1122334455', 'City': 'Chicago' }
      ]);
      setImportStep(2);
    }
  };

  const mockColumns = previewData.length > 0 ? Object.keys(previewData[0]).map((key, index) => ({
    name: key,
    type: 'text',
    detected: true,
    mapped: true
  })) : [];

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
              <BreadcrumbPage>Import Table</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Import Table</h1>
            <p className="text-muted-foreground">
              Import data from CSV, Excel, or other file formats.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/dashboard/tables">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tables
            </a>
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-8 py-4">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${importStep >= 1 ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              1
            </div>
            <span className={`text-sm ${importStep >= 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
              Upload File
            </span>
          </div>
          <div className={`w-16 h-0.5 ${importStep >= 2 ? 'bg-blue-600' : 'bg-muted'}`} />
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${importStep >= 2 ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              2
            </div>
            <span className={`text-sm ${importStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
              Configure
            </span>
          </div>
          <div className={`w-16 h-0.5 ${importStep >= 3 ? 'bg-blue-600' : 'bg-muted'}`} />
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${importStep >= 3 ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              3
            </div>
            <span className={`text-sm ${importStep >= 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
              Import
            </span>
          </div>
        </div>

        {/* Step 1: File Upload */}
        {importStep === 1 && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Your File</CardTitle>
                  <CardDescription>
                    Choose a CSV, Excel, or other data file to import.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Drop your file here</h3>
                      <p className="text-muted-foreground">
                        Or click to browse your files
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.tsv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    Supported formats: CSV, Excel (.xlsx, .xls), TSV
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Supported Formats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">CSV (.csv)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Excel (.xlsx, .xls)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Tab-separated (.tsv)</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {importStep === 2 && selectedFile && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* File Info */}
              <Card>
                <CardHeader>
                  <CardTitle>File Information</CardTitle>
                  <CardDescription>
                    Review your uploaded file details.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">{selectedFile.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {previewData.length} rows
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Table Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Table Configuration</CardTitle>
                  <CardDescription>
                    Configure how your data will be imported.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tableName">Table Name</Label>
                    <Input
                      id="tableName"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this table contains..."
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

              {/* Column Mapping */}
              <Card>
                <CardHeader>
                  <CardTitle>Column Mapping</CardTitle>
                  <CardDescription>
                    Review and adjust how columns will be imported.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockColumns.map((column, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${column.mapped ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {column.mapped ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </div>
                          <div>
                            <div className="font-medium">{column.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Detected as {column.type}
                            </div>
                          </div>
                        </div>
                        <Badge variant={column.detected ? 'default' : 'secondary'}>
                          {column.detected ? 'Auto-detected' : 'Manual'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Data Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Preview</CardTitle>
                  <CardDescription>
                    Preview of the first few rows from your file.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {mockColumns.map((column, index) => (
                            <th key={index} className="text-left p-2 font-medium">
                              {column.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 3).map((row, index) => (
                          <tr key={index} className="border-b">
                            {mockColumns.map((column, colIndex) => (
                              <td key={colIndex} className="p-2">
                                {row[column.name]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Showing 3 of {previewData.length} rows
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Settings Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Import Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">File:</span>
                    <span className="ml-2 font-medium">{selectedFile.name}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Rows:</span>
                    <span className="ml-2 font-medium">{previewData.length}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Columns:</span>
                    <span className="ml-2 font-medium">{mockColumns.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-amber-600" />
                    Important Note
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Make sure your data is clean and properly formatted before importing. 
                    You can always edit individual cells after import.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  onClick={() => setImportStep(3)}
                  disabled={!tableName || !workspace}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Import Table
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setImportStep(1)}
                >
                  Choose Different File
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Import Success */}
        {importStep === 3 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Import Successful!</h2>
            <p className="text-muted-foreground mb-6">
              Your table "{tableName}" has been imported with {previewData.length} rows.
            </p>
            <div className="space-x-4">
              <Button asChild>
                <a href="/dashboard/tables/1">
                  View Table
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/dashboard/tables">
                  Back to Tables
                </a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}