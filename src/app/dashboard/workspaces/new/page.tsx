'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  ArrowLeft,
  Database,
  Users,
  Lock,
  Globe,
  Plus,
  X,
  Mail,
  UserPlus
} from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  role: string;
}

export default function NewWorkspacePage() {
  const [workspaceName, setWorkspaceName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [template, setTemplate] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');

  const addTeamMember = () => {
    if (newMemberEmail && !teamMembers.find(m => m.email === newMemberEmail)) {
      const newMember: TeamMember = {
        id: Date.now().toString(),
        email: newMemberEmail,
        role: newMemberRole
      };
      setTeamMembers([...teamMembers, newMember]);
      setNewMemberEmail('');
      setNewMemberRole('viewer');
    }
  };

  const removeMember = (id: string) => {
    setTeamMembers(teamMembers.filter(m => m.id !== id));
  };

  const updateMemberRole = (id: string, role: string) => {
    setTeamMembers(teamMembers.map(m => 
      m.id === id ? { ...m, role } : m
    ));
  };

  const workspaceTemplates = [
    { value: 'blank', label: 'Blank Workspace', description: 'Start from scratch' },
    { value: 'project', label: 'Project Management', description: 'Tasks, timelines, and resources' },
    { value: 'crm', label: 'Customer Management', description: 'Contacts, deals, and interactions' },
    { value: 'hr', label: 'HR & People', description: 'Employee data and processes' },
    { value: 'inventory', label: 'Inventory Management', description: 'Products, stock, and suppliers' },
    { value: 'finance', label: 'Financial Tracking', description: 'Budgets, expenses, and reports' }
  ];

  const roleOptions = [
    { value: 'owner', label: 'Owner', description: 'Full access and control' },
    { value: 'admin', label: 'Admin', description: 'Manage workspace and members' },
    { value: 'editor', label: 'Editor', description: 'Create and edit content' },
    { value: 'viewer', label: 'Viewer', description: 'View and comment only' }
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
              <BreadcrumbLink href="/dashboard/workspaces">Workspaces</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>New Workspace</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Create New Workspace</h1>
            <p className="text-muted-foreground">
              Set up a workspace to organize your tables and collaborate with your team.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/dashboard/workspaces">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workspaces
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
                  Provide basic details about your workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workspaceName">Workspace Name</Label>
                  <Input
                    id="workspaceName"
                    placeholder="e.g., Marketing Team, Product Development"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this workspace is used for..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Template Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Choose a Template</CardTitle>
                <CardDescription>
                  Start with a pre-configured workspace or build from scratch.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {workspaceTemplates.map((templ) => (
                    <div
                      key={templ.value}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        template === templ.value
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-border hover:border-blue-300'
                      }`}
                      onClick={() => setTemplate(templ.value)}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="template"
                          value={templ.value}
                          checked={template === templ.value}
                          onChange={() => setTemplate(templ.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{templ.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {templ.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>
                      Invite people to collaborate in this workspace.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {teamMembers.length + 1} members
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current User (Owner) */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>YO</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">You</div>
                      <div className="text-sm text-muted-foreground">john.doe@example.com</div>
                    </div>
                  </div>
                  <Badge>Owner</Badge>
                </div>

                {/* Team Members List */}
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>
                          {member.email.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.email}</div>
                        <div className="text-sm text-muted-foreground">Pending invitation</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Select
                        value={member.role}
                        onValueChange={(value) => updateMemberRole(member.id, value)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.slice(1).map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(member.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Add New Member */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Invite new member</span>
                  </div>
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Enter email address"
                        type="email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                      />
                    </div>
                    <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.slice(1).map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={addTeamMember} disabled={!newMemberEmail}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings Sidebar */}
          <div className="space-y-6">
            {/* Privacy Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Visibility</CardTitle>
                <CardDescription>
                  Control who can discover and access this workspace.
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
                    Only invited members can access
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
                    Anyone in your organization can discover and request access
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
                  <span className="text-muted-foreground">Template:</span>
                  <span className="ml-2 font-medium">
                    {template ? workspaceTemplates.find(t => t.value === template)?.label : 'None selected'}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Members:</span>
                  <span className="ml-2 font-medium">{teamMembers.length + 1}</span>
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
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button className="w-full" size="lg" disabled={!workspaceName}>
                <Database className="h-4 w-4 mr-2" />
                Create Workspace
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