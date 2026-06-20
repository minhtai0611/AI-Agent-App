import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders markdown with Zenith typography: muted body text, warm headings, styled code/links.
 *
 * @example
 * <MarkdownProse>{markdownString}</MarkdownProse>
 */
export default function MarkdownProse({ children, className = '' }) {
  if (!children) return null
  return (
    <div className={`font-sans text-[0.8125rem] text-muted leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p:          ({ children: c }) => <p className="mb-2 last:mb-0">{c}</p>,
          strong:     ({ children: c }) => <strong className="font-semibold text-foreground">{c}</strong>,
          em:         ({ children: c }) => <em className="italic text-muted">{c}</em>,
          ul:         ({ children: c }) => <ul className="list-disc pl-5 mb-2 space-y-1">{c}</ul>,
          ol:         ({ children: c }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{c}</ol>,
          li:         ({ children: c }) => <li>{c}</li>,
          h1:         ({ children: c }) => <h1 className="font-sans font-bold text-[15px] text-foreground mb-1 mt-3 first:mt-0">{c}</h1>,
          h2:         ({ children: c }) => <h2 className="font-sans font-bold text-sm text-foreground mb-1 mt-3 first:mt-0">{c}</h2>,
          h3:         ({ children: c }) => <h3 className="font-sans text-[0.8125rem] font-semibold text-foreground mb-1 mt-2 first:mt-0">{c}</h3>,
          code:       ({ children: c }) => <code className="px-1 py-0.5 rounded bg-border text-primary text-xs font-mono">{c}</code>,
          blockquote: ({ children: c }) => <blockquote className="border-l-2 border-border-subtle pl-3 italic text-dim">{c}</blockquote>,
          a:          ({ href, children: c }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-info hover:text-info/70 underline">{c}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
