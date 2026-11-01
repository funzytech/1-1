import React, { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  // Helper to parse blocks: code blocks, headings, lists, paragraphs
  const parseBlocks = (raw: string) => {
    const lines = raw.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];
    let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null;
    let blockCounter = 0;

    const flushList = () => {
      if (!listBuffer) return;
      const currentList = listBuffer;
      listBuffer = null;
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`list-${blockCounter++}`} className="my-2.5 ml-4 space-y-1.5 list-disc list-outside text-[#2c1a0e]/90 text-sm leading-relaxed">
            {currentList.items.map((it, idx) => (
              <li key={idx} className="pl-1">
                {renderInline(it)}
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${blockCounter++}`} className="my-2.5 ml-4 space-y-1.5 list-decimal list-outside text-[#2c1a0e]/90 text-sm leading-relaxed">
            {currentList.items.map((it, idx) => (
              <li key={idx} className="pl-1">
                {renderInline(it)}
              </li>
            ))}
          </ol>
        );
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block start/end
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          flushList();
          inCodeBlock = true;
          codeLanguage = line.trim().replace(/^```/, '').trim() || 'code';
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          const codeString = codeBuffer.join('\n');
          const codeIdx = blockCounter++;
          elements.push(
            <div key={`code-${codeIdx}`} className="my-3 overflow-hidden rounded-xl border border-[#4a3420]/30 bg-[#1e140d] text-[#f5ebd8] shadow-md">
              <div className="flex items-center justify-between border-b border-[#3b2818] bg-[#140c07] px-3.5 py-1.5 text-xs text-[#b89b80]">
                <span className="font-mono uppercase tracking-wider text-[11px] font-semibold text-amber-400/90">
                  {codeLanguage}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeString, codeIdx)}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium text-[#c4a88f] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title="Copy code"
                >
                  {copiedIndex === codeIdx ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed select-text text-amber-50">
                <code>{codeString}</code>
              </pre>
            </div>
          );
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Check unordered list item
      const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      if (ulMatch) {
        if (!listBuffer || listBuffer.type !== 'ul') {
          flushList();
          listBuffer = { type: 'ul', items: [] };
        }
        listBuffer.items.push(ulMatch[2]);
        continue;
      }

      // Check ordered list item
      const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (olMatch) {
        if (!listBuffer || listBuffer.type !== 'ol') {
          flushList();
          listBuffer = { type: 'ol', items: [] };
        }
        listBuffer.items.push(olMatch[2]);
        continue;
      }

      // Line is not a list item, flush any open list
      flushList();

      // Blank line
      if (!line.trim()) {
        continue;
      }

      // Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${blockCounter++}`} className="font-['Outfit',sans-serif] font-bold text-base text-[#261508] mt-3.5 mb-1 tracking-tight">
            {renderInline(line.replace('### ', ''))}
          </h4>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={`h2-${blockCounter++}`} className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] mt-4 mb-1.5 tracking-tight border-b border-[#8c7054]/20 pb-1">
            {renderInline(line.replace('## ', ''))}
          </h3>
        );
        continue;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={`h1-${blockCounter++}`} className="font-['Outfit',sans-serif] font-black text-xl text-[#261508] mt-4 mb-2 tracking-tight">
            {renderInline(line.replace('# ', ''))}
          </h2>
        );
        continue;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={`quote-${blockCounter++}`} className="border-l-3 border-amber-600/70 bg-amber-500/10 pl-3 py-1.5 my-2.5 rounded-r-lg text-xs sm:text-sm text-[#4a3420] italic">
            {renderInline(line.replace('> ', ''))}
          </blockquote>
        );
        continue;
      }

      // Standard paragraph
      elements.push(
        <p key={`p-${blockCounter++}`} className="my-2 text-sm text-[#2c1a0e]/95 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }

    flushList();
    return elements;
  };

  // Helper to parse inline styles: bold, italics, inline code, links
  const renderInline = (text: string): React.ReactNode => {
    // Regex matches inline code `code`, bold **text**, italics *text*, links [label](url)
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;

      // Inline code
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code
            key={i}
            className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-amber-950 border border-black/10"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={i} className="font-extrabold text-[#1a0c04]">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Italics
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <em key={i} className="italic text-[#3b2716]">
            {part.slice(1, -1)}
          </em>
        );
      }

      // Link [title](url)
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-800 font-semibold underline decoration-amber-600/50 hover:decoration-amber-700 transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      }

      return part;
    });
  };

  return <div className="space-y-1">{parseBlocks(content)}</div>;
};
