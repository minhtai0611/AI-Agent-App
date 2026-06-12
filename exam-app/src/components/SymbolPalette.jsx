import { useState } from 'react'
import { SYMBOL_GROUPS } from '../data/symbolGroups'

export default function SymbolPalette({ onInsert }) {
  const [activeGroup, setActiveGroup] = useState(0)
  const [open, setOpen] = useState(() => window.innerWidth >= 640)

  return (
    <div className="border-t border-surface bg-surface">
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="sm:hidden w-full flex items-center justify-between px-4 py-2 font-sans text-[12px] text-dim hover:text-muted transition"
      >
        <span>Ký hiệu</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div>
          {/* Tab bar */}
          <div className="flex gap-0 overflow-x-auto scrollbar-none border-b border-surface">
            {SYMBOL_GROUPS.map((group, i) => (
              <button
                key={group.name}
                type="button"
                onClick={() => setActiveGroup(i)}
                className={`shrink-0 px-3 py-1.5 font-sans text-[11px] transition whitespace-nowrap
                  ${activeGroup === i
                    ? 'border-b-2 border-info text-info'
                    : 'text-dim hover:text-muted'
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
                className="w-8 h-8 flex items-center justify-center font-sans text-[13px] text-muted
                  rounded hover:bg-surface hover:text-foreground transition"
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
