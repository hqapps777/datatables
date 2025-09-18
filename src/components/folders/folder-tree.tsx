'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  MoreVertical,
  Plus,
  Edit,
  Trash,
  Move,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolderNode {
  id: number;
  name: string;
  parentId: number | null;
  children: FolderNode[];
  tableCount: number;
  isExpanded?: boolean;
}

interface FolderTreeProps {
  folders: FolderNode[];
  onFolderSelect?: (folderId: number) => void;
  onCreateFolder?: (parentId: number | null) => void;
  onEditFolder?: (folderId: number) => void;
  onDeleteFolder?: (folderId: number) => void;
  onMoveFolder?: (folderId: number) => void;
  selectedFolderId?: number;
  className?: string;
}

interface FolderItemProps {
  folder: FolderNode;
  level: number;
  onFolderSelect?: (folderId: number) => void;
  onCreateFolder?: (parentId: number | null) => void;
  onEditFolder?: (folderId: number) => void;
  onDeleteFolder?: (folderId: number) => void;
  onMoveFolder?: (folderId: number) => void;
  onToggleExpand?: (folderId: number) => void;
  selectedFolderId?: number;
}

function FolderItem({
  folder,
  level,
  onFolderSelect,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onMoveFolder,
  onToggleExpand,
  selectedFolderId,
}: FolderItemProps) {
  const hasChildren = folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;
  const isExpanded = folder.isExpanded ?? false;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors",
          isSelected && "bg-accent text-accent-foreground",
          "group"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggleExpand?.(folder.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6" />
        )}

        {/* Folder Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-600" />
          ) : (
            <Folder className="h-4 w-4 text-blue-600" />
          )}
        </div>

        {/* Folder Name */}
        <button
          className="flex-1 text-left text-sm font-medium truncate"
          onClick={() => onFolderSelect?.(folder.id)}
        >
          {folder.name}
        </button>

        {/* Table Count */}
        {folder.tableCount > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {folder.tableCount}
          </span>
        )}

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCreateFolder?.(folder.id)}>
              <Plus className="h-4 w-4 mr-2" />
              New Subfolder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEditFolder?.(folder.id)}>
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveFolder?.(folder.id)}>
              <Move className="h-4 w-4 mr-2" />
              Move
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDeleteFolder?.(folder.id)}
              className="text-destructive"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {hasChildren && (
        <Collapsible open={isExpanded}>
          <CollapsibleContent className="space-y-1">
            {folder.children.map((child) => (
              <FolderItem
                key={child.id}
                folder={child}
                level={level + 1}
                onFolderSelect={onFolderSelect}
                onCreateFolder={onCreateFolder}
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                onMoveFolder={onMoveFolder}
                onToggleExpand={onToggleExpand}
                selectedFolderId={selectedFolderId}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function FolderTree({
  folders,
  onFolderSelect,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onMoveFolder,
  selectedFolderId,
  className,
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  const handleToggleExpand = (folderId: number) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Add expansion state to folders
  const foldersWithExpansion = folders.map(folder => 
    addExpansionState(folder, expandedFolders)
  );

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Folders</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onCreateFolder?.(null)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {foldersWithExpansion.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Folder className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">No folders yet</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => onCreateFolder?.(null)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Folder
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {foldersWithExpansion.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              level={0}
              onFolderSelect={onFolderSelect}
              onCreateFolder={onCreateFolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveFolder={onMoveFolder}
              onToggleExpand={handleToggleExpand}
              selectedFolderId={selectedFolderId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function addExpansionState(folder: FolderNode, expandedFolders: Set<number>): FolderNode {
  return {
    ...folder,
    isExpanded: expandedFolders.has(folder.id),
    children: folder.children.map(child => addExpansionState(child, expandedFolders)),
  };
}