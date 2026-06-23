import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AssistantMarkdownProps {
  content: string;
}

function normalizeAssistantMarkdown(content: string): string {
  return (content || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/\n{4,}/g, "\n\n\n");
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="my-2 max-w-full break-words first:mt-0 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="my-2 list-disc space-y-1 pl-5 marker:text-purple-300">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-purple-300">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
        code: ({ className, children, ...props }) => {
          const isInline = !className?.includes("language-");
          return isInline ? (
            <code
              className="max-w-full rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-cyan-100 break-words [overflow-wrap:anywhere]"
              {...props}
            >
              {children}
            </code>
          ) : (
            <code className={`${className || ""} block font-mono text-[0.85em]`} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-3 max-w-full overflow-x-auto whitespace-pre rounded-xl border border-white/10 bg-black/50 p-3 text-[0.85em] leading-relaxed">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words text-cyan-300 underline-offset-2 [overflow-wrap:anywhere] hover:underline"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold tracking-tight first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold tracking-tight first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold tracking-tight first:mt-0">{children}</h3>,
        h4: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold text-foreground/90 first:mt-0">{children}</h4>,
        blockquote: ({ children }) => (
          <blockquote className="my-3 border-l-2 border-purple-500/50 pl-3 text-foreground/80">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4 border-white/10" />,
        table: ({ children }) => (
          <div className="my-3 w-full max-w-[calc(100vw-4rem)] overflow-x-auto rounded-xl border border-white/10 bg-black/20 sm:max-w-full">
            <table className="min-w-[520px] border-collapse text-left text-[0.9em] leading-relaxed">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-white/15 bg-white/[0.03]">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-white/5 last:border-b-0">{children}</tr>,
        th: ({ children }) => (
          <th className="px-3 py-2 text-[0.78em] font-semibold uppercase tracking-wide text-muted-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => <td className="px-3 py-2 align-top text-foreground/90">{children}</td>,
      }}
    >
      {normalizeAssistantMarkdown(content)}
    </ReactMarkdown>
  );
}

export default function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  return <MarkdownBody content={content} />;
}
