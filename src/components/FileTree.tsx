import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, File } from 'lucide-react';
import clsx from 'clsx';
import { listFiles } from '../lib/api';

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

interface Props {
  projectId: string;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
}

interface TreeNodeProps {
  entry: FileEntry;
  projectId: string;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
  depth: number;
}

function TreeNode({ entry, projectId, selectedPath, onSelectFile, depth }: TreeNodeProps) {
  const [open, setOpen] = useState(false);

  const { data: children, isLoading } = useQuery({
    queryKey: ['files', projectId, entry.path],
    queryFn: () => listFiles(projectId, entry.path),
    enabled: entry.type === 'directory' && open,
    select: (data) => {
      const sorted = [...data.entries].filter(e => e.name !== 'meta.json');
      sorted.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
      return sorted;
    },
  });

  const paddingLeft = depth * 12 + 8;

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-1.5 py-1 pr-2 text-sm text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors text-left"
          style={{ paddingLeft }}
          aria-expanded={open}
        >
          <span className="flex-shrink-0 text-[#6e7681]">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="flex-shrink-0 text-[#58a6ff]">
            {open ? <FolderOpen size={13} /> : <Folder size={13} />}
          </span>
          <span className="truncate">{entry.name}</span>
        </button>
        {open && (
          <div>
            {isLoading && (
              <p
                className="text-xs text-[#484f58] py-1"
                style={{ paddingLeft: paddingLeft + 20 }}
              >
                Loading...
              </p>
            )}
            {children?.map(child => (
              <TreeNode
                key={child.path}
                entry={child}
                projectId={projectId}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isMd = entry.name.endsWith('.md');
  const isSelected = selectedPath === entry.path;

  return (
    <button
      onClick={() => onSelectFile(entry.path)}
      className={clsx(
        'w-full flex items-center gap-1.5 py-1 pr-2 text-sm rounded transition-colors text-left',
        isSelected
          ? 'bg-[#1f6feb33] text-[#e6edf3]'
          : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
      )}
      style={{ paddingLeft: paddingLeft + 14 }}
      aria-current={isSelected ? 'page' : undefined}
    >
      <span className="flex-shrink-0 text-[#6e7681]">
        {isMd ? <FileText size={13} /> : <File size={13} />}
      </span>
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

export function FileTree({ projectId, selectedPath, onSelectFile }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['files', projectId],
    queryFn: () => listFiles(projectId),
    select: (data) => {
      const sorted = [...data.entries].filter(e => e.name !== 'meta.json');
      sorted.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
      return sorted;
    },
  });

  if (isLoading) {
    return (
      <div className="px-3 py-4 text-xs text-[#484f58]">Loading files...</div>
    );
  }

  if (isError) {
    return (
      <div className="px-3 py-4 text-xs text-[#f85149]">Failed to load files.</div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-[#484f58]">No files found.</div>
    );
  }

  return (
    <nav aria-label="File tree" className="px-1 py-2">
      {data.map(entry => (
        <TreeNode
          key={entry.path}
          entry={entry}
          projectId={projectId}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          depth={0}
        />
      ))}
    </nav>
  );
}
