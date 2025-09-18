'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { FolderTree } from '@/components/folders/folder-tree';
import { TableList, mockTables } from '@/components/tables/table-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Database,
  Plus,
  Settings,
  Users,
  FolderOpen,
  Table,
  Share2,
  Archive
} from 'lucide-react';

// Mock data
const mockWorkspace = {
  id: 1,
  name: 'My Personal Workspace',
  description: 'Personal projects and experiments',
  role: 'owner',
  memberCount: 1,
  folderCount: 3,
  tableCount: 8,
  createdAt: '2024-01-15',
};

const mockFolders = [
  {
    id: 1,
    name: 'Projects',
    parentId: null,
    tableCount: 3,
    children: [
      {
        id: 2,
        name: 'Web Apps',
        parentId: 1,
        tableCount: 2,
        children: [],
      },
      {
        id: 3,
        name: 'Mobile Apps',
        parentId: 1,
        tableCount: 1,
        children: [],
      },
    ],
  },
  {
    id: 4,
    name: 'Analytics',
    parentId: null,
    tableCount: 2,
    children: [
      {
        id: 5,
        name: 'User Data',
        parentId: 4,
        tableCount: 1,
        children: [],
      },
    ],
  },
  {
    id: 6,
    name: 'Archive',
    parentId: null,
    tableCount: 0,
    children: [],
  },
];

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const [selectedFolderId, setSelectedFolderId] = useState<number>();

  const handleFolderSelect = (folderId: number) => {
    setSelectedFolderId(folderId);
  };

  const handleCreateFolder = (parentId: number | null) => {
    console.log('Create folder with parent:', parentId);
  };

  const handleEditFolder = (folderId: number) => {
    console.log('Edit folder:', folderId);
  };

  const handleDeleteFolder = (folderId: number) => {
    console.log('Delete folder:', folderId);
  };

  const handleMoveFolder = (folderId: number) => {
    console.log('Move folder:', folderId);
  };

  const handleCreateTable = (folderId: number) => {
    console.log('Create table in folder:', folderId);
  };

  const handleEditTable = (tableId: number) => {
    console.log('Edit table:', tableId);
  };

  const handleDeleteTable = (tableId: number) => {
    console.log('Delete table:', tableId);
  };

  const handleArchiveTable = (tableId: number) => {
    console.log('Archive table:', tableId);
  };

  const handleDuplicateTable = (tableId: number) => {
    console.log('Duplicate table:', tableId);
  };

  // Get selected folder name
  const getSelectedFolderName = (folderId: number): string => {
    const findFolder = (folders: any[]): string | null => {
      for (const folder of folders) {
        if (folder.id === folderId) return folder.name;
        if (folder.children.length > 0) {
          const found = findFolder(folder.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findFolder(mockFolders) || 'Folder';
  };

  // Filter tables by selected folder
  const tablesInFolder = selectedFolderId
    ? mockTables.filter(table => table.folderId === selectedFolderId)
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/workspaces">Workspaces</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{mockWorkspace.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Database className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{mockWorkspace.name}</h1>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-muted-foreground">{mockWorkspace.description}</p>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {mockWorkspace.role}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Folders</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockWorkspace.folderCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tables</CardTitle>
              <Table className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockWorkspace.tableCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockWorkspace.memberCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-12">
          {/* Folder Tree */}
          <div className="md:col-span-4">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Folder Structure</span>
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FolderTree
                  folders={mockFolders}
                  selectedFolderId={selectedFolderId}
                  onFolderSelect={handleFolderSelect}
                  onCreateFolder={handleCreateFolder}
                  onEditFolder={handleEditFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onMoveFolder={handleMoveFolder}
                />
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="md:col-span-8">
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedFolderId 
                    ? `Folder Contents` 
                    : 'Select a folder to view its contents'
                  }
                </CardTitle>
                <CardDescription>
                  {selectedFolderId
                    ? 'Tables and subfolders in the selected folder'
                    : 'Use the folder tree on the left to navigate your workspace'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedFolderId ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Tables</h3>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Table
                      </Button>
                    </div>
                    <div className="text-muted-foreground">
                      Tables will be displayed here...
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>Select a folder to view its contents</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}