import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
export default function MarkdownRenderer({ text }: { text: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: 'h2',
        table: ({ node: _node, ...props }) => (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Content table"
          >
            <table {...props} />
          </div>
        ),
      }}
    >
      {text}
    </Markdown>
  )
}
