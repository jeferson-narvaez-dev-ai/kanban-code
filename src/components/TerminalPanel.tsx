import { useState } from 'react'
import { Terminal } from './Terminal'
import { X, TerminalSquare, Minus, Plus } from 'lucide-react'

interface TerminalPanelProps {
  onClose: () => void
  cwd?: string
}

export function TerminalPanel({ onClose, cwd }: TerminalPanelProps) {
  const [height, setHeight] = useState(280)

  return (
    <div className="flex flex-col border-t border-[#30363d] bg-[#0d1117]" style={{ height: height + 36 }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 h-9 bg-[#161b22] border-b border-[#30363d] flex-shrink-0">
        <div className="flex items-center gap-2 text-[#8b949e] text-xs font-medium">
          <TerminalSquare size={13} />
          <span>Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setHeight(h => Math.max(120, h - 80))}
            className="p-1 text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
            title="Decrease height"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={() => setHeight(h => Math.min(600, h + 80))}
            className="p-1 text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
            title="Increase height"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
            title="Close terminal"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      {/* xterm container */}
      <div className="flex-1 overflow-hidden">
        <Terminal height={height} cwd={cwd} />
      </div>
    </div>
  )
}
