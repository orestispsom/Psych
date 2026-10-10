import { useMemo, useState } from 'react'
import { Dialog } from '../../components/Dialog'
import { search, type SearchResult } from '../../content/search'
import { useI18n } from '../../i18n'
export function SearchDialog({
  index,
  onClose,
  onSelect,
}: {
  index: SearchResult[]
  onClose: () => void
  onSelect: (r: SearchResult) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState(''),
    [limit, setLimit] = useState(20)
  const results = useMemo(() => search(index, query), [index, query])
  return (
    <Dialog
      title={t('searchTitle')}
      className="search-modal"
      onClose={onClose}
    >
      <label className="search-input-row">
        {t('searchTopics')}
        <input
          data-initial-focus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(20)
          }}
          placeholder={t('searchPlaceholder')}
        />
      </label>
      <p aria-live="polite">
        {query.trim()
          ? results.length === 1
            ? t('oneResult')
            : t('results', { count: results.length })
          : t('searchCurriculum')}
      </p>
      <div className="search-results">
        {results.slice(0, limit).map((r) => (
          <button
            key={r.key}
            className="search-result"
            onClick={() => onSelect(r)}
          >
            <span className="search-result__kind">
              {r.question ? t('question') : t('topic')}
            </span>
            <span className="search-result__body">
              <strong>{r.question?.prompt ?? r.chunk.title}</strong>
              <small>
                {r.key} · {r.chunk.title}
              </small>
            </span>
          </button>
        ))}
        {query.trim() && !results.length && <p>{t('noMatch')}</p>}
        {results.length > limit && (
          <button
            className="utility-button"
            onClick={() => setLimit((l) => l + 20)}
          >
            Show 20 more
          </button>
        )}
      </div>
    </Dialog>
  )
}
