import type { Curriculum } from '../../content/types'
import type { LearningSnapshot } from '../../learning/types'
import { planToday } from '../../learning/planner'
import { useI18n } from '../../i18n'

export function TodayScreen({
  data,
  state,
  onStart,
}: {
  data: Curriculum
  state: LearningSnapshot
  onStart: () => void
}) {
  const { locale, t } = useI18n()
  const plan = planToday(data, state.chunks, state.questions, state.settings)
  const session = state.sessions
    .filter((s) => s.kind === 'today' && s.cursor < s.items.length)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
  const remaining = session?.items.slice(session.cursor)
  const studies =
    remaining?.filter((i) => i.kind === 'study').length ??
    plan.newChunks + plan.updatedChunks
  const reviews =
    remaining?.filter((i) => i.kind === 'review').length ??
    plan.items.filter((i) => i.kind === 'review').length

  return (
    <div className="page page--today">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat(locale === 'el' ? 'el-GR' : 'en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }).format(new Date())}
          </p>
          <h1>{t('today')}</h1>
        </div>
      </div>

      <section className="today-card" aria-labelledby="today-title">
        <div className="today-card__meta">
          <span className="status-pill">{t('todayDailyStudy')}</span>
          <span>
            {t('todayDailyPlan', {
              count: state.settings.dailyNewLimit ?? 3,
            })}
          </span>
        </div>

        <h2 id="today-title">
          {studies + reviews
            ? t('todayFocusedWork', {
                minutes: session
                  ? Math.ceil(studies * 3 + reviews * 0.5)
                  : plan.estimatedMinutes,
              })
            : t('todayComplete')}
        </h2>

        <p className="muted">{t('todayGuidedSession')}</p>

        <div className="workload">
          <div>
            <strong>{studies}</strong>
            <span>{t('todayTopicsToStudy')}</span>
          </div>
          <div>
            <strong>{reviews}</strong>
            <span>{t('todayQuestionsToRetrieve')}</span>
          </div>
          <div>
            <strong>{plan.dueReviews}</strong>
            <span>{t('todayDueNow')}</span>
          </div>
        </div>

        {!session && plan.paceLimited && (
          <p className="notice">{t('todayPaceWarning')}</p>
        )}

        {studies + reviews > 0 ? (
          <button className="primary-button" onClick={onStart}>
            {session ? t('todayResumeSession') : t('todayStartSession')}
          </button>
        ) : (
          <p>{t('todayLibraryFallback')}</p>
        )}
      </section>

      <p className="muted">
        {t('todayCurriculumStatus', { count: data.chunks.length })}
      </p>
    </div>
  )
}
