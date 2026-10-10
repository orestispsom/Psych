import type { RuntimeChunk } from '../../content/types'
import { domainName } from '../../content/domains'
import { AuthoredMarkdown } from '../../components/Markdown'
import { useI18n } from '../../i18n'
export function StudyScreen({
  chunk,
  revisit,
  onBack,
  onTest,
}: {
  chunk: RuntimeChunk
  revisit: boolean
  onBack: () => void
  onTest: () => void
}) {
  const { t, locale } = useI18n()
  const roles: Record<string, string> = { clinical:'Κλινικό θέμα', management:'Αντιμετώπιση', precision:'Κριτήρια και όρια', framework:'Πλαίσιο', comparison:'Σύγκριση', differential:'Διαφορική διάγνωση', mechanism:'Μηχανισμός', methodology:'Μεθοδολογία', synthesis:'Σύνθεση' }
  return (
    <div className="content-mode">
      <header className="focus-header">
        <button className="utility-button" onClick={onBack}>
          ← {revisit ? t('backToQuestion') : t('back')}
        </button>
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
        <button className="primary-button" onClick={revisit ? onBack : onTest}>
          {revisit ? t('backToQuestion') : t('testYourself')}
        </button>
      </article>
    </div>
  )
}
