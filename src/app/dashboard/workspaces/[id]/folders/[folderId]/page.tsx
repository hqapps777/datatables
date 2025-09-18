import { DashboardLayout } from '@/components/dashboard/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Search, 
  Filter,
  MoreHorizontal,
  Calendar,
  Users,
  Lock,
  Globe,
  FileText,
  FolderOpen,
  BarChart3,
  Upload,
  Download,
  Share,
  Edit,
  Trash2,
  ArrowUpRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FolderPageProps {
  params: {
    id: string;
    folderId: string;
  };
}

// Mock data for folder contents
const folderData = {
  id: '1',
  name: 'Projects',
  workspace: 'My Workspace',
  description: 'Project-related tables and data',
  created: '2 months ago',
  owner: {
    name: 'John Doe',
    email: 'john.doe@company.com',
    avatar: '/avatars/john.jpg'
  },
  collaborators: 5,
  totalItems: 8
};

const folderItems = [
  {
    id: 1,
    type: 'table',
    name: 'Customer Database',
    description: 'Customer information and contact details',
    rows: 1247,
    columns: 12,
    lastModified: '2 hours ago',
    modifiedBy: 'Sarah Johnson',
    shared: true,
    visibility: 'private',
    size: '2.3 MB'
  },
  {
    id: 2,
    type: 'table',
    name: 'Project Timeline',
    description: 'Project milestones and deadlines',
    rows: 156,
    columns: 8,
    lastModified: '1 day ago',
    modifiedBy: 'Mike Chen',
    shared: false,
    visibility: 'public',
    size: '456 KB'
  },
  {
    id: 3,
    type: 'folder',
    name: 'Archive',
    description: 'Archived project data',
    items: 12,
    lastModified: '1 week ago',
    modifiedBy: 'Emma Davis',
    shared: false,
    visibility: 'private',
    size: '15.7 MB'
  },
  {
    id: 4,
    type: 'table',
    name: 'Budget Tracker',
    description: 'Project budget and expenses',
    rows: 89,
    columns: 6,
    lastModified: '3 days ago',
    modifiedBy: 'Alex Rodriguez',
    shared: true,
    visibility: 'private',
    size: '234 KB'
  }
];

const getItemIcon = (type: string) => {
  switch (type) {
    case 'table':
      return <FileText className="h-4 w-4" />;
    case 'folder':
      return <FolderOpen className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export default function FolderPage({ params }: FolderPageProps) {
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
              <BreadcrumbLink href="/dashboard/workspaces">Workspaces</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/dashboard/workspaces/${params.id}`}>
                {folderData.workspace}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{folderData.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <FolderOpen className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold tracking-tight">{folderData.name}</h1>
            </div>
            <p className="text-muted-foreground">
              {folderData.description}
            </p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{folderData.totalItems} items</span>
              <span>•</span>
              <span>Created {folderData.created}</span>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3" />
                <span>{folderData.collaborators} collaborators</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Share className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Folder Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{folderData.totalItems}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tables</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {folderItems.filter(item => item.type === 'table').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subfolders</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {folderItems.filter(item => item.type === 'folder').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collaborators</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{folderData.collaborators}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in folder..."
                className="pl-8 w-[300px]"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Folder Contents */}
        <div className="space-y-3">
          {folderItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      {getItemIcon(item.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium truncate">{item.name}</h3>
                        <Badge variant={item.visibility === 'public' ? 'default' : 'secondary'}>
                          {item.visibility === 'public' ? (
                            <Globe className="h-3 w-3 mr-1" />
                          ) : (
                            <Lock className="h-3 w-3 mr-1" />
                          )}
                          {item.visibility}
                        </Badge>
                        {item.shared && (
                          <Badge variant="outline">
                            <Share className="h-3 w-3 mr-1" />
                            Shared
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {item.description}
                      </p>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                        {item.type === 'table' ? (
                          <>
                            <span>{item.rows?.toLocaleString()} rows</span>
                            <span>•</span>
                            <span>{item.columns} columns</span>
                          </>
                        ) : (
                          <span>{item.items} items</span>
                        )}
                        <span>•</span>
                        <span>{item.size}</span>
                        <span>•</span>
                        <span>Modified {item.lastModified} by {item.modifiedBy}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Open</DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share className="h-4 w-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {folderItems.length === 0 && (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Folder is empty</h3>
                <p className="text-muted-foreground mt-1">
                  Add tables or create subfolders to organize your data.
                </p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}