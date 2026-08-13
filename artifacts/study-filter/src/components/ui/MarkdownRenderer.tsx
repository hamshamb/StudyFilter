import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import { useReadingSize } from "@/hooks/use-reading-size";

interface MarkdownRendererProps {
  children: string;
  className?: string;
  compact?: boolean;
}

export const MarkdownRenderer = React.memo(
  function MarkdownRenderer({ children, className, compact = false }: MarkdownRendererProps) {
    // Only load heavy math plugins when content has math
    const hasMath = /\$/.test(children);
    const remarkPlugins = hasMath ? [remarkMath] : [];
    const rehypePlugins = hasMath ? [rehypeKatex] : [];
    const { fontSize } = useReadingSize();

    return (
      <div
        // Tailwind Typography sizes headings/lists/etc. in em, relative to
        // this container's font-size — so the reading-size preference scales
        // the whole block proportionally from one place, set in Settings.
        style={{ fontSize }}
        className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-p:my-1 prose-p:leading-relaxed",
        "prose-ul:my-1 prose-ul:pl-5",
        "prose-ol:my-1 prose-ol:pl-5",
        "prose-li:my-0.5 prose-li:leading-relaxed",
        "prose-headings:font-bold prose-headings:text-foreground",
        "prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1",
        "prose-h4:text-sm prose-h4:mt-2 prose-h4:mb-0.5",
        "prose-strong:font-semibold prose-strong:text-foreground",
        "prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5",
        "prose-blockquote:border-l-primary/40 prose-blockquote:text-muted-foreground",
        compact && "prose-p:my-0.5 prose-ul:my-0.5 prose-li:my-0",
        className
      )}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={{
            p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="my-1 space-y-0.5 pl-5 list-disc">{children}</ul>,
            ol: ({ children }) => <ol className="my-1 space-y-0.5 pl-5 list-decimal">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            code: ({ children, className: cls }) => {
              const isBlock = cls?.includes("language-");
              if (isBlock) return (
                <code className="block bg-muted rounded-lg px-3 py-2 text-sm font-mono overflow-x-auto">
                  {children}
                </code>
              );
              return <code className="bg-muted rounded px-1 py-0.5 text-[0.82em] font-mono">{children}</code>;
            },
            /*
             * Comparison tables are one of the most common shapes a CBSE
             * answer takes ("differences between X and Y"), and a three-column
             * one at 390px is wider than the screen. Without this the table
             * pushed the whole page sideways. It scrolls inside its own box
             * now, with a border so the edge reads as a boundary rather than
             * as content being cut off.
             */
            table: ({ children }) => (
              <div className="scroll-x my-3 rounded-lg border border-border">
                <table className="w-full border-collapse text-left text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
            th: ({ children }) => (
              <th className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-border px-3 py-2 align-top leading-relaxed last:border-r-0">
                {children}
              </td>
            ),
          }}
        >
          {children}
        </ReactMarkdown>
      </div>
    );
  },
  // Only re-render if content actually changed
  (prev, next) =>
    prev.children === next.children &&
    prev.compact === next.compact &&
    prev.className === next.className
);
