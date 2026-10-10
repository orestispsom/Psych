import { useI18n } from '../../i18n'
import type { ContentIndex, RuntimeChunk } from '../../content/types'
import { domainName } from '../../content/domains'
import type { LearningSnapshot } from '../../learning/types'
import { chunkState } from '../../learning/progress'
export function LibraryScreen({
  index,
  state,
  onToggle,
  onOpen,
}: {
  index: ContentIndex
  state: LearningSnapshot
  onToggle: (id: string) => void
  onOpen: (c: RuntimeChunk) => void
}) {
  const { t, locale } = useI18n()
  const stateLabels = { New:t('stateNew'), Learning:t('stateLearning'), Due:t('stateDue'), Retained:t('stateRetained') }
  const chunks = new Map(state.chunks.map((c) => [c.chunkId, c])),
    questions = new Map(state.questions.map((q) => [q.questionId, q]))
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {t('libraryCurriculum', { count:index.chunks.size })}
          </p>
          <h1>{t('library')}</h1>
        </div>
      </div>
      <div className="domain-list">
        {[...index.domains].map(([id, topics]) => {
          const expanded = state.ui.expandedDomains.includes(id),
            studied = topics.filter(
              (c) => chunks.get(c.id)?.studyCompletedAt,
            ).length
          return (
            <section key={id} className="domain-group">
              <button
                className="domain-header"
                aria-expanded={expanded}
                aria-controls={`domain-${id}`}
                onClick={() => onToggle(id)}
              >
                <span>
                  {expanded ? '−' : '+'} {domainName(id, locale)}
                </span>
                <span>
                  {studied} / {topics.length} {t('studied')}
                </span>
              </button>
              {expanded && (
                <div id={`domain-${id}`}>
                  {topics.map((c) => (
                    <button
                      key={c.id}
                      className="library-row"
                      onClick={() => onOpen(c)}
                    >
                      <span className="library-row__id">{c.id}</span>
                      <span className="library-row__title">{c.title}</span>
                      <span
                        className={
                          'state-badge state-badge--' +
                          chunkState(
                            c,
                            chunks.get(c.id),
                            questions,
                          ).toLowerCase()
                        }
                      >
                        {stateLabels[chunkState(c, chunks.get(c.id), questions)]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
