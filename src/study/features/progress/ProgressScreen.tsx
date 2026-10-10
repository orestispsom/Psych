import { useI18n } from '../../i18n'
import type { ContentIndex } from '../../content/types'
import type { LearningSnapshot } from '../../learning/types'
import { progressMetrics } from '../../learning/progress'
import { domainName } from '../../content/domains'
export function ProgressScreen({
  index,
  state,
}: {
  index: ContentIndex
  state: LearningSnapshot
}) {
  const { t, locale } = useI18n()
  const m = progressMetrics(index, state.chunks, state.questions, state.logs)
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {t('progressMeasured')}
          </p>
          <h1>{t('progress')}</h1>
        </div>
      </div>
      <div className="metrics-grid">
        <section className="metric-card">
          <h2>{t('coverage')}</h2>
          <strong>
            {m.studied} / {m.total}
          </strong>
          <p>{t('topicsStudied')}</p>
        </section>
        <section className="metric-card">
          <h2>{t('recentRecall')}</h2>
          <strong>
            {m.recall === null ? '—' : Math.round(m.recall * 100) + '%'}
          </strong>
          <p>{t('recentRecallCaption',{ count:m.recentCount })}</p>
        </section>
        <section className="metric-card">
          <h2>{t('dueWorkload')}</h2>
          <strong>{m.due}</strong>
          <p>{t('questionsDue')}</p>
        </section>
      </div>
      <section className="section">
        <h2>{t('domainsRevisit')}</h2>
        <p className="muted">
          {t('domainsRevisitCaption')}
        </p>
        {m.weak.length ? (
          m.weak.map((d) => (
            <div className="weak-domain" key={d.id}>
              <span>{domainName(d.id, locale)}</span>
              <span>
                {Math.round(d.recall * 100)}% · {d.count} {t('ratings')}
              </span>
            </div>
          ))
        ) : (
          <p>{t('notEnoughHistory')}</p>
        )}
      </section>
    </div>
  )
}
