'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Database, MoreVertical, FolderOpen, Table, Users, Settings, Archive } from 'lucide-react';
import Link from 'next/link';

// Mock data - will be replaced with API calls
const mockWorkspaces = [
  {
    id: 1,
    name: 'My Personal Workspace',
    description: 'Personal projects and experiments',
    folderCount: 3,
    tableCount: 8,
    memberCount: 1,
    role: 'owner',
    createdAt: '2024-01-15',
    isArchived: false,
  },
  {
    id: 2,
    name: 'Team Collaboration',
    description: 'Shared workspace for team projects and data analysis',
    folderCount: 5,
    tableCount: 12,
    memberCount: 6,
    role: 'editor',
    createdAt: '2024-01-20',
    isArchived: false,
  },
  {
    id: 3,
    name: 'Client Project Alpha',
    description: 'Data management for client deliverables',
    folderCount: 2,
    tableCount: 4,
    memberCount: 3,
    role: 'viewer',
    createdAt: '2024-02-01',
    isArchived: false,
  },
];

export function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState(mockWorkspaces);

  const handleArchiveWorkspace = (workspaceId: number) => {
    setWorkspaces(prev => 
      prev.map(ws => 
        ws.id === workspaceId 
          ? { ...ws, isArchived: !ws.isArchived }
          : ws
      )
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-green-100 text-green-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {workspaces.filter(ws => !ws.isArchived).map((workspace) => (
        <Card key={workspace.id} className="group hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-blue-600" />
                <Badge variant="secondary" className={getRoleColor(workspace.role)}>
                  {workspace.role}
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
                    <Link href={`/dashboard/workspaces/${workspace.id}`}>
                      Open Workspace
                    </Link>
                  </DropdownMenuItem>
                  {workspace.role === 'owner' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/workspaces/${workspace.id}/settings`}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleArchiveWorkspace(workspace.id)}
                        className="text-red-600"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardTitle className="text-lg">{workspace.name}</CardTitle>
            <CardDescription>{workspace.description}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{workspace.folderCount}</div>
                <div className="text-xs text-muted-foreground">Folders</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Table className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{workspace.tableCount}</div>
                <div className="text-xs text-muted-foreground">Tables</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{workspace.memberCount}</div>
                <div className="text-xs text-muted-foreground">Members</div>
              </div>
            </div>
            
            <Button 
              asChild 
              className="w-full" 
              variant={workspace.role === 'viewer' ? 'outline' : 'default'}
            >
              <Link href={`/dashboard/workspaces/${workspace.id}`}>
                {workspace.role === 'viewer' ? 'View Workspace' : 'Open Workspace'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
      
      {workspaces.filter(ws => !ws.isArchived).length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
          <Database className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No workspaces found</h3>
          <p className="text-muted-foreground mb-4">
            Create your first workspace to start organizing your data.
          </p>
        </div>
      )}
    </div>
  );
}