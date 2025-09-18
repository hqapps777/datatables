import { DashboardLayout } from '@/components/dashboard/layout';
import { WorkspaceList } from '@/components/workspaces/workspace-list';
import { CreateWorkspaceDialog } from '@/components/workspaces/create-workspace-dialog';
import { Button } from '@/components/ui/button';
import { Plus, Database } from 'lucide-react';

export default function WorkspacesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-6 w-6" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
              <p className="text-muted-foreground mt-2">
                Organize your data into separate workspaces for different projects or teams.
              </p>
            </div>
          </div>
          <CreateWorkspaceDialog>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Workspace
            </Button>
          </CreateWorkspaceDialog>
        </div>

        {/* Workspace List */}
        <WorkspaceList />
      </div>
    </DashboardLayout>
  );
}