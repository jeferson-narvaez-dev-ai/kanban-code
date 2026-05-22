import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Upload } from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileTree } from './FileTree';
import { getFileContent, saveFileContent } from '../lib/api';

interface Props {
  projectId: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

const BINARY_EXTS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);
function ext(p: string) { return p.slice(p.lastIndexOf('.')).toLowerCase(); }
function isBinary(p: string) { return BINARY_EXTS.has(ext(p)); }
function isPdf(p: string) { return ext(p) === '.pdf'; }
function isImage(p: string) { return ['.png','.jpg','.jpeg','.gif','.svg','.webp'].includes(ext(p)); }

// Inner editor keyed by path — remounts cleanly on file change
interface EditorProps {
  projectId: string;
  filePath: string;
  initialContent: string;
}

function FileEditor({ projectId, filePath, initialContent }: EditorProps) {
  const binary = isBinary(filePath);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [draftContent, setDraftContent] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (content: string) => saveFileContent(projectId, filePath, content),
    onSuccess: () => {
      setSaveStatus('saved');
      void queryClient.invalidateQueries({ queryKey: ['file-content', projectId, filePath] });
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('idle');
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleContentChange = useCallback(
    (value: string) => {
      setDraftContent(value);
      setSaveStatus('saving');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveMutation.mutate(value);
      }, 1500);
    },
    [saveMutation],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* File header bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#30363d] bg-[#161b22] gap-3">
        <p className="text-xs text-[#8b949e] font-mono truncate min-w-0">{filePath}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveStatus === 'saving' && (
            <span className="text-xs text-[#e3b341]">Saving...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-[#3fb950]">Saved</span>
          )}
          {!binary && (
          <div className="flex items-center rounded-md overflow-hidden border border-[#30363d]">
            <button
              onClick={() => setMode('preview')}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#58a6ff]',
                mode === 'preview'
                  ? 'bg-[#21262d] text-[#e6edf3]'
                  : 'bg-transparent text-[#8b949e] hover:text-[#e6edf3]',
              )}
              aria-pressed={mode === 'preview'}
            >
              <Eye size={11} aria-hidden="true" />
              Preview
            </button>
            <button
              onClick={() => setMode('edit')}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#58a6ff] border-l border-[#30363d]',
                mode === 'edit'
                  ? 'bg-[#21262d] text-[#e6edf3]'
                  : 'bg-transparent text-[#8b949e] hover:text-[#e6edf3]',
              )}
              aria-pressed={mode === 'edit'}
            >
              <Pencil size={11} aria-hidden="true" />
              Edit
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {isPdf(filePath) ? (
          <iframe
            src={`/api/projects/${projectId}/files/raw?path=${encodeURIComponent(filePath)}`}
            className="w-full h-full border-none bg-white"
            title={filePath}
          />
        ) : isImage(filePath) ? (
          <div className="flex items-center justify-center h-full overflow-auto p-6 bg-[#0d1117]">
            <img
              src={`/api/projects/${projectId}/files/raw?path=${encodeURIComponent(filePath)}`}
              alt={filePath}
              className="max-w-full max-h-full object-contain rounded"
            />
          </div>
        ) : mode === 'preview' ? (
          filePath.endsWith('.html') ? (
            <iframe
              srcDoc={draftContent}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-none bg-white"
              title={filePath}
            />
          ) : (
          <div className="h-full overflow-y-auto px-6 py-5">
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-[#e6edf3] prose-headings:font-semibold prose-headings:border-b prose-headings:border-[#30363d] prose-headings:pb-1
              prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base
              prose-p:text-[#c9d1d9] prose-p:leading-relaxed
              prose-a:text-[#58a6ff] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-[#e6edf3]
              prose-code:text-[#f0883e] prose-code:bg-[#21262d] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-[#161b22] prose-pre:border prose-pre:border-[#30363d] prose-pre:rounded-md
              prose-pre:text-[#c9d1d9] prose-pre:text-xs
              prose-table:text-sm prose-table:border-collapse
              prose-th:text-[#e6edf3] prose-th:bg-[#161b22] prose-th:border prose-th:border-[#30363d] prose-th:px-3 prose-th:py-1.5
              prose-td:text-[#c9d1d9] prose-td:border prose-td:border-[#30363d] prose-td:px-3 prose-td:py-1.5
              prose-li:text-[#c9d1d9]
              prose-blockquote:border-l-[#30363d] prose-blockquote:text-[#8b949e]
              prose-hr:border-[#30363d]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftContent}</ReactMarkdown>
            </div>
          </div>
          )
        ) : (
          <textarea
            value={draftContent}
            onChange={(e) => handleContentChange(e.target.value)}
            className={clsx(
              'w-full h-full resize-none bg-[#0d1117] text-[#e6edf3] font-mono text-sm leading-relaxed',
              'px-6 py-5 focus:outline-none border-none',
            )}
            aria-label="File editor"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}

// Loader: fetches content then renders the keyed editor
interface FileViewProps {
  projectId: string;
  filePath: string;
}

function FileView({ projectId, filePath }: FileViewProps) {
  const binary = isBinary(filePath);

  const { data: fileData, isLoading } = useQuery({
    queryKey: ['file-content', projectId, filePath],
    queryFn: () => getFileContent(projectId, filePath),
    staleTime: Infinity,
    enabled: !binary, // skip text fetch for PDFs/images
  });

  if (!binary && isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[#8b949e]">Loading...</p>
      </div>
    );
  }

  return (
    <FileEditor
      key={filePath}
      projectId={projectId}
      filePath={filePath}
      initialContent={fileData?.content ?? ''}
    />
  );
}

export function DocsView({ projectId }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3001/ws`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; projectId?: string };
        if (msg.type === 'files:changed' && msg.projectId === projectId) {
          void queryClient.invalidateQueries({ queryKey: ['files', projectId] });
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, [projectId, queryClient]);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClickUpload() {
    fileInputRef.current?.click();
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    await uploadFiles(files);
  }

  async function uploadFiles(files: File[]) {
    setUploadStatus('uploading');
    const formData = new FormData();
    files.forEach(f => formData.append('file', f));
    try {
      const res = await fetch(`/api/projects/${projectId}/files/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      setUploadStatus('success');
      void queryClient.invalidateQueries({ queryKey: ['files', projectId] });
      setTimeout(() => setUploadStatus('idle'), 2500);
    } catch {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    await uploadFiles(files);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* File tree sidebar */}
      <aside
        className="w-[220px] flex-shrink-0 border-r border-[#30363d] bg-[#161b22] overflow-y-auto"
        aria-label="File browser"
      >
        <div className="px-3 py-2 border-b border-[#30363d]">
          <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">Files</p>
        </div>
        <FileTree
          projectId={projectId}
          selectedPath={selectedPath}
          onSelectFile={setSelectedPath}
        />
      </aside>

      {/* Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedPath ? (
          <div
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 transition-colors cursor-pointer',
              isDragOver ? 'bg-[#1f6feb15]' : ''
            )}
            onClick={handleClickUpload}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={clsx(
              'flex items-center justify-center w-16 h-16 rounded-full border-2 border-dashed transition-colors',
              isDragOver ? 'border-[#58a6ff] bg-[#1f6feb22]' : 'border-[#30363d] bg-[#161b22]'
            )}>
              {uploadStatus === 'uploading' ? (
                <svg className="animate-spin w-6 h-6 text-[#58a6ff]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : uploadStatus === 'success' ? (
                <svg className="w-6 h-6 text-[#3fb950]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <Upload size={22} className={isDragOver ? 'text-[#58a6ff]' : 'text-[#8b949e]'} />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-[#8b949e]">Select a file from the tree to view or edit it.</p>
              <p className="text-xs text-[#484f58]">
                {uploadStatus === 'uploading' ? 'Uploading...' :
                 uploadStatus === 'success' ? '✓ File added to references/' :
                 uploadStatus === 'error' ? '✗ Upload failed' :
                 'or click / drag & drop to add to references/'}
              </p>
            </div>
          </div>
        ) : (
          <FileView projectId={projectId} filePath={selectedPath} />
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
    </div>
  );
}
