import { DashboardLayout } from '@/components/dashboard/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Search, 
  Filter,
  MoreHorizontal,
  Calendar,
  Users,
  Lock,
  Globe,
  FileText,
  BarChart3,
  Eye,
  Edit,
  Share
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock data for shared items
const sharedItems = [
  {
    id: 1,
    name: 'Q4 Sales Report',
    type: 'table',
    description: 'Quarterly sales performance analysis',
    owner: {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      avatar: '/avatars/sarah.jpg'
    },
    sharedDate: '3 days ago',
    lastAccessed: '1 hour ago',
    permission: 'edit',
    rows: 1847,
    columns: 9,
    collaborators: 7,
    workspace: 'Sales Team'
  },
  {
    id: 2,
    name: 'Product Roadmap',
    type: 'table',
    description: 'Product development timeline and milestones',
    owner: {
      name: 'Mike Chen',
      email: 'mike.chen@company.com',
      avatar: '/avatars/mike.jpg'
    },
    sharedDate: '1 week ago',
    lastAccessed: '2 days ago',
    permission: 'view',
    rows: 234,
    columns: 12,
    collaborators: 4,
    workspace: 'Product Team'
  },
  {
    id: 3,
    name: 'Customer Feedback',
    type: 'table',
    description: 'Customer survey responses and feedback data',
    owner: {
      name: 'Emma Davis',
      email: 'emma.davis@company.com',
      avatar: '/avatars/emma.jpg'
    },
    sharedDate: '2 weeks ago',
    lastAccessed: '5 hours ago',
    permission: 'edit',
    rows: 892,
    columns: 7,
    collaborators: 3,
    workspace: 'Customer Success'
  },
  {
    id: 4,
    name: 'Marketing Campaigns',
    type: 'folder',
    description: 'Campaign performance and analytics data',
    owner: {
      name: 'Alex Rodriguez',
      email: 'alex.rodriguez@company.com',
      avatar: '/avatars/alex.jpg'
    },
    sharedDate: '1 month ago',
    lastAccessed: '1 week ago',
    permission: 'view',
    items: 12,
    collaborators: 6,
    workspace: 'Marketing Team'
  }
];

const getPermissionBadge = (permission: string) => {
  switch (permission) {
    case 'edit':
      return <Badge variant="default"><Edit className="h-3 w-3 mr-1" />Can edit</Badge>;
    case 'view':
      return <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />View only</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'table':
      return <FileText className="h-4 w-4" />;
    case 'folder':
      return <Users className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export default function SharedItemsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shared with me</h1>
            <p className="text-muted-foreground mt-2">
              Tables and folders that others have shared with you.
            </p>
          </div>
          <Button variant="outline">
            <Share className="h-4 w-4 mr-2" />
            Share Item
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Shared</CardTitle>
              <Share className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sharedItems.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Can Edit</CardTitle>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sharedItems.filter(item => item.permission === 'edit').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">View Only</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sharedItems.filter(item => item.permission === 'view').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collaborators</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sharedItems.reduce((acc, item) => acc + item.collaborators, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shared items..."
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>

        {/* Shared Items List */}
        <div className="space-y-4">
          {sharedItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      {getTypeIcon(item.type)}
                    </div>
                    
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {item.description}
                      </CardDescription>
                      
                      {/* Owner Info */}
                      <div className="flex items-center space-x-2 pt-1">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={item.owner.avatar} />
                          <AvatarFallback className="text-xs">
                            {item.owner.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          Shared by {item.owner.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  
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
                      {item.permission === 'edit' && (
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                      )}
                      <DropdownMenuItem>Copy Link</DropdownMenuItem>
                      <DropdownMenuItem>Add to Favorites</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        Remove Access
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Workspace</div>
                    <div>{item.workspace}</div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Permission</div>
                    <div>{getPermissionBadge(item.permission)}</div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">
                      {item.type === 'table' ? 'Size' : 'Items'}
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.type === 'table' ? (
                        <>
                          <span>{item.rows?.toLocaleString()} rows</span>
                          <span className="text-muted-foreground">•</span>
                          <span>{item.columns} cols</span>
                        </>
                      ) : (
                        <span>{item.items} items</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Last Access</div>
                    <div className="flex items-center text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      {item.lastAccessed}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {sharedItems.length === 0 && (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <Share className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No shared items yet</h3>
                <p className="text-muted-foreground mt-1">
                  When others share tables or folders with you, they'll appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}