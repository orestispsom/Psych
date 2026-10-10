import type { RuntimeChunk, RuntimeQuestion } from '../../content/types'
import type { ReviewRating, SessionRecord } from '../../learning/types'
import { AuthoredMarkdown } from '../../components/Markdown'
import { useI18n } from '../../i18n'
export function RecallScreen({
  chunk,
  question,
  session,
  onReveal,
  onRate,
  onTopic,
  onBack,
}: {
  chunk: RuntimeChunk
  question: RuntimeQuestion
  session: SessionRecord
  onReveal: () => void
  onRate: (r: ReviewRating) => void
  onTopic: () => void
  onBack: () => void
}) {
  const { t } = useI18n()
  const ratingLabels = [
    t('ratingAgain'),
    t('ratingHard'),
    t('ratingGood'),
    t('ratingEasy'),
  ]
  return (
    <div className="review-mode">
      <header className="focus-header">
        <button className="utility-button" onClick={onBack}>
          ← {t('pauseSession')}
        </button>
        <span>
          {session.cursor + 1} / {session.items.length}
        </span>
      </header>
      <div
        className="session-progress"
        role="progressbar"
        aria-label={t('sessionProgress')}
        aria-valuemin={0}
        aria-valuemax={session.items.length}
        aria-valuenow={session.cursor}
      >
        <span
          style={{ width: `${(100 * session.cursor) / session.items.length}%` }}
        />
      </div>
      <div className="review-card">
        <p className="eyebrow">
          {chunk.id} · {chunk.title}
        </p>
        <h1 className="review-prompt">{question.prompt}</h1>
        {session.revealed ? (
          <>
            <div className="model-answer">
              <AuthoredMarkdown text={question.modelAnswer} />
            </div>
            <button className="utility-button" onClick={onTopic}>
              {t('reviewTopic')}
            </button>
          </>
        ) : (
          <button className="primary-button" onClick={onReveal}>
            {t('revealAnswer')} <kbd>Space</kbd>
          </button>
        )}
      </div>
      {session.revealed && (
        <div className="rating-bar">
          {(['again', 'hard', 'good', 'easy'] as const).map((r, i) => (
            <button
              key={r}
              className={
                'rating-button' +
                (r === 'good' ? ' rating-button--primary' : '')
              }
              onClick={() => onRate(r)}
            >
              <span>{ratingLabels[i]}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
