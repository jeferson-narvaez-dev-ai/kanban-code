import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Settings } from 'lucide-react';
import { getProjectConfig, saveProjectConfig, type ProjectConfig } from '../lib/api';

interface Props {
  projectId: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function ConfigEditor({ projectId, config }: { projectId: string; config: ProjectConfig }) {
  const queryClient = useQueryClient();
  const [setupCmds, setSetupCmds] = useState(config.setupCommands.join('\n'));
  const [testCmds, setTestCmds] = useState(config.testCommands.join('\n'));
  const [instructions, setInstructions] = useState(config.setupInstructions);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Reset when config changes (e.g., projectId switches)
  useEffect(() => {
    setSetupCmds(config.setupCommands.join('\n'));
    setTestCmds(config.testCommands.join('\n'));
    setInstructions(config.setupInstructions);
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (content: string) => saveProjectConfig(projectId, content),
    onSuccess: () => {
      setSaveStatus('saved');
      void queryClient.invalidateQueries({ queryKey: ['project-config', projectId] });
      setTimeout(() => setSaveStatus('idle'), 2500);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
  });

  function buildRaw(): string {
    const setupArr = setupCmds
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    const testArr = testCmds
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const setupYaml = setupArr.map(c => `  - ${c}`).join('\n');
    const testYaml = testArr.map(c => `  - ${c}`).join('\n');
    const instrValue = instructions.trim()
      ? instructions.trim().split('\n').map(l => `  ${l}`).join('\n')
      : '  Describe any manual setup steps here.';

    return `---
setupCommands:
${setupYaml || '  []'}
testCommands:
${testYaml || '  []'}
setupInstructions: |
${instrValue}
---

# Project Configuration

## Setup Commands
Run these before starting work on this project.

## Test Commands
These MUST pass before moving any task to \`waiting-approval\`.
`;
  }

  function handleSave() {
    setSaveStatus('saving');
    saveMutation.mutate(buildRaw());
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex items-center gap-2">
          <Settings size={15} className="text-[#8b949e]" />
          <h2 className="text-sm font-semibold text-[#e6edf3]">Project Config</h2>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && (
            <span className="text-xs text-[#e3b341]">Saving...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-[#3fb950]">Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-[#f85149]">Save failed</span>
          )}
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded border border-[#30363d] hover:border-[#8b949e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-[#58a6ff]"
          >
            <Save size={12} />
            Save
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Setup Commands */}
        <section>
          <label className="block text-sm font-semibold text-[#e6edf3] mb-1">
            Setup Commands
          </label>
          <p className="text-xs text-[#8b949e] mb-2">
            Run these before starting work on this project. One command per line.
          </p>
          <textarea
            value={setupCmds}
            onChange={e => setSetupCmds(e.target.value)}
            rows={4}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-md text-sm text-[#e6edf3] font-mono px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#58a6ff] focus:border-[#58a6ff] placeholder-[#484f58]"
            placeholder="npm install&#10;npm run build"
            spellCheck={false}
          />
        </section>

        {/* Test Commands */}
        <section>
          <label className="block text-sm font-semibold text-[#e6edf3] mb-1">
            Test Commands
          </label>
          <p className="text-xs text-[#8b949e] mb-2">
            These MUST pass before any task can be moved to{' '}
            <code className="text-[#f0883e] bg-[#21262d] px-1 py-0.5 rounded text-[11px]">
              waiting-approval
            </code>
            . One command per line.
          </p>
          <textarea
            value={testCmds}
            onChange={e => setTestCmds(e.target.value)}
            rows={4}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-md text-sm text-[#e6edf3] font-mono px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#58a6ff] focus:border-[#58a6ff] placeholder-[#484f58]"
            placeholder="npm test&#10;npm run lint"
            spellCheck={false}
          />
        </section>

        {/* Setup Instructions */}
        <section>
          <label className="block text-sm font-semibold text-[#e6edf3] mb-1">
            Setup Instructions
          </label>
          <p className="text-xs text-[#8b949e] mb-2">
            Manual steps agents and developers should follow before starting work.
          </p>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows={6}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-md text-sm text-[#e6edf3] px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#58a6ff] focus:border-[#58a6ff] placeholder-[#484f58]"
            placeholder="Describe any manual setup steps here."
          />
        </section>
      </div>
    </div>
  );
}

export function ProjectConfigView({ projectId }: Props) {
  const { data: config, isLoading } = useQuery({
    queryKey: ['project-config', projectId],
    queryFn: () => getProjectConfig(projectId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[#8b949e]">Loading config...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[#f85149]">Failed to load project config.</p>
      </div>
    );
  }

  return <ConfigEditor key={projectId} projectId={projectId} config={config} />;
}
