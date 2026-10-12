import type { RuntimeChunk } from '../../content/types'
import { domainName } from '../../content/domains'
import { AuthoredMarkdown } from '../../components/Markdown'
import { useI18n } from '../../i18n'
export function StudyScreen({
  chunk,
  revisit,
  onBack,
  onTest,
  onHome,
  onNext,
  onPrevious,
  position,
}: {
  chunk: RuntimeChunk
  revisit: boolean
  onBack: () => void
  onTest: () => void
  onHome?: () => void
  onNext?: () => void
  onPrevious?: () => void
  position?: string
}) {
  const { t, locale } = useI18n()
  const roles: Record<string, string> = { clinical:'Κλινικό θέμα', management:'Αντιμετώπιση', precision:'Κριτήρια και όρια', framework:'Πλαίσιο', comparison:'Σύγκριση', differential:'Διαφορική διάγνωση', mechanism:'Μηχανισμός', methodology:'Μεθοδολογία', synthesis:'Σύνθεση' }
  return (
    <div className="content-mode">
      <header className="focus-header">
        <button className="utility-button" onClick={onBack}>
          ← {revisit ? t('backToQuestion') : onPrevious ? (locale === 'el' ? 'Προηγούμενο' : 'Previous') : t('back')}
        </button>
        {position && <span>{position}</span>}
        {onHome && <button className="utility-button" type="button" onClick={onHome} aria-label={locale === 'el' ? 'Αρχική Μελέτης' : 'Study Home'} title={locale === 'el' ? 'Αρχική Μελέτης' : 'Study Home'}>⌂</button>}
        <span>
          {chunk.id} · {domainName(chunk.domainId, locale)}
        </span>
      </header>
      <article className="reading-page">
        <p className="eyebrow">
          {locale === 'el' ? roles[chunk.role] : chunk.role} · {t('revision')} {chunk.revision}
        </p>
        <h1>{chunk.title}</h1>
        <AuthoredMarkdown
          text={chunk.studyMarkdown.replace(/^#\s+[^\n]+\n\s*/, '')}
        />
        <aside className="remember-box" aria-label={t('summary')}>
          <AuthoredMarkdown text={chunk.rememberMarkdown} />
        </aside>
        <div className="path-reader-actions">
          <button className="primary-button" onClick={revisit ? onBack : onTest}>
            {revisit ? t('backToQuestion') : t('testYourself')}
          </button>
          {onPrevious && <button className="utility-button" onClick={onPrevious}>← {locale === 'el' ? 'Προηγούμενο θέμα' : 'Previous topic'}</button>}
          {onNext && <button className="utility-button" onClick={onNext}>{locale === 'el' ? 'Επόμενο θέμα' : 'Next topic'} →</button>}
        </div>
      </article>
    </div>
  )
}
