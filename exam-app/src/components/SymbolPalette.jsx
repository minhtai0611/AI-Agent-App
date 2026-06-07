import { useState } from 'react'
import { SYMBOL_GROUPS } from '../data/symbolGroups'

export default function SymbolPalette({ onInsert }) {
  const [activeGroup, setActiveGroup] = useState(0)
  const [open, setOpen] = useState(() => window.innerWidth >= 640)

  return (
    <div className="border-t border-border-subtle bg-background">
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="sm:hidden w-full flex items-center justify-between px-4 py-2 font-jakarta text-xs text-faint hover:text-muted transition"
      >
        <span>Ký hiệu</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div>
          {/* Tab bar */}
          <div className="flex gap-0 overflow-x-auto scrollbar-none border-b border-border-subtle">
            {SYMBOL_GROUPS.map((group, i) => (
              <button
                key={group.name}
                type="button"
                onClick={() => setActiveGroup(i)}
                className={`shrink-0 px-3 py-1.5 font-jakarta text-[0.6875rem] transition whitespace-nowrap
                  ${activeGroup === i
                    ? 'border-b-2 border-[#6366F1] text-[#6366F1]'
                    : 'text-faint hover:text-muted'
                  }`}
              >
                {group.name}
              </button>
            ))}
          </div>

          {/* Symbol grid */}
          <div className="flex flex-wrap gap-1 p-2">
            {SYMBOL_GROUPS[activeGroup].symbols.map(sym => (
              <button
                key={sym.insert}
                type="button"
                title={sym.title}
                onClick={() => onInsert(sym.insert)}
                className="w-8 h-8 flex items-center justify-center font-jakarta text-[0.8125rem] text-muted
                  rounded hover:bg-[#1E293B] hover:text-[#E2E8F0] transition"
              >
                {sym.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
