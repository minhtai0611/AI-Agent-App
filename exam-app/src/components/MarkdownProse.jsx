import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownProse({ children, className = '' }) {
  if (!children) return null
  return (
    <div className={`font-jakarta text-[13px] text-[#94A3B8] leading-relaxed prose-dark ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-[#F0F4FF]">{children}</strong>,
          em: ({ children }) => <em className="italic text-[#94A3B8]">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h1 className="font-fraunces text-[15px] font-semibold text-[#F0F4FF] mb-1 mt-3 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="font-fraunces text-[14px] font-semibold text-[#F0F4FF] mb-1 mt-3 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="font-jakarta text-[13px] font-semibold text-[#F0F4FF] mb-1 mt-2 first:mt-0">{children}</h3>,
          code: ({ children }) => <code className="px-1 py-0.5 rounded bg-[#1E2A44] text-[#F2A20C] text-[12px] font-mono">{children}</code>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-[#2A3A5E] pl-3 italic text-[#64748B]">{children}</blockquote>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#6366F1] hover:text-[#818CF8] underline">{children}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
