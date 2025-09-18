'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  FolderOpen, 
  Table, 
  Settings, 
  Users,
  Plus,
  ChevronDown,
  ChevronRight,
  Database
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Workspaces',
    href: '/dashboard/workspaces',
    icon: Database,
  },
  {
    name: 'All Tables',
    href: '/dashboard/tables',
    icon: Table,
  },
  {
    name: 'Shared with me',
    href: '/dashboard/shared',
    icon: Users,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<number[]>([]);

  const toggleWorkspace = (workspaceId: number) => {
    setExpandedWorkspaces(prev => 
      prev.includes(workspaceId)
        ? prev.filter(id => id !== workspaceId)
        : [...prev, workspaceId]
    );
  };

  return (
    <div className={cn('pb-12 w-64', className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center mb-4">
            <Database className="h-8 w-8 mr-2 text-blue-600" />
            <h2 className="text-lg font-semibold">DataTables</h2>
          </div>
          
          <Button className="w-full justify-start" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </Button>
        </div>
        
        <div className="px-3 py-2">
          <div className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
                  pathname === item.href 
                    ? 'bg-accent text-accent-foreground' 
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-4 w-4 mr-3" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="px-3 py-2">
          <h3 className="mb-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Workspaces
          </h3>
          <div className="space-y-1">
            {/* Example workspace - will be populated from API */}
            <div>
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2 h-8"
                onClick={() => toggleWorkspace(1)}
              >
                {expandedWorkspaces.includes(1) ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                <Database className="h-4 w-4 mr-2" />
                <span className="truncate">My Workspace</span>
              </Button>
              
              {expandedWorkspaces.includes(1) && (
                <div className="ml-6 space-y-1">
                  <Link
                    href="/dashboard/workspaces/1/folders/1"
                    className="flex items-center rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Projects
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}