import { lazy, Suspense } from 'react'
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'))
export function AuthoredMarkdown({ text }: { text: string }) {
  return (
    <Suspense fallback={<p role="status">Φόρτωση κειμένου…</p>}>
      <MarkdownRenderer text={text} />
    </Suspense>
  )
}
