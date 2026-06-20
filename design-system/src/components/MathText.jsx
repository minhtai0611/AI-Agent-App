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
      <table className="border-collapse text-xs w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border-subtle px-3 py-1.5 font-semibold text-muted-fg text-left bg-surface-elevated">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-border-subtle px-3 py-1.5 text-muted">{children}</td>
  ),
}

/**
 * Inline math + markdown renderer (wraps in `<span>`).
 * Suitable for question stems, answer choices, and short math expressions.
 * Supports $…$ and $$…$$ LaTeX via KaTeX.
 *
 * @example
 * <MathText>Tính $\int_0^1 x^2 \, dx$</MathText>
 */
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

/**
 * Block math + markdown renderer (preserves paragraph breaks).
 * Suitable for explanations, study plan text, and multi-paragraph content.
 *
 * @example
 * <MathBlock>{explanationMarkdown}</MathBlock>
 */
export function MathBlock({ children, className }) {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={{
          p:      ({ children: c }) => <p className="mb-2 last:mb-0">{c}</p>,
          strong: ({ children: c }) => <strong className="font-semibold text-muted-fg">{c}</strong>,
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
