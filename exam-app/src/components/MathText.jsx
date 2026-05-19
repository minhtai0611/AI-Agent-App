import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const REMARK_PLUGINS = [remarkGfm, [remarkMath, { singleDollarTextMath: true }]]
const REHYPE_PLUGINS = [rehypeKatex]

const TABLE_COMPONENTS = {
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse text-[12px] w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[#2A3A5E] px-3 py-1.5 font-semibold text-[#CBD5E1] text-left bg-[#111827]">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-[#2A3A5E] px-3 py-1.5 text-[#94A3B8]">{children}</td>
  ),
}

// Inline (default): wraps paragraphs in <span> — suitable for stems, choices, tasks.
// Block (block=true): preserves <p> paragraph breaks — suitable for explanations, plan text.
export function MathText({ children, className, style }) {
  return (
    <span className={className} style={style}>
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={{
          p:  ({ children: c }) => <span>{c}</span>,
          ol: ({ children: c }) => <span>{c}</span>,
          ul: ({ children: c }) => <span>{c}</span>,
          li: ({ children: c }) => <span>{c}</span>,
          ...TABLE_COMPONENTS,
        }}
      >
        {children ?? ''}
      </Markdown>
    </span>
  )
}

export function MathBlock({ children, className }) {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={{
          p:      ({ children: c }) => <p className="mb-2 last:mb-0">{c}</p>,
          strong: ({ children: c }) => <strong className="font-semibold text-[#CBD5E1]">{c}</strong>,
          em:     ({ children: c }) => <em className="italic">{c}</em>,
          ul:     ({ children: c }) => <ul className="list-disc pl-5 space-y-1">{c}</ul>,
          ol:     ({ children: c }) => <ol className="list-decimal pl-5 space-y-1">{c}</ol>,
          li:     ({ children: c }) => <li className="leading-relaxed">{c}</li>,
          ...TABLE_COMPONENTS,
        }}
      >
        {children ?? ''}
      </Markdown>
    </div>
  )
}
