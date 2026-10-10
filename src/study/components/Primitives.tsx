import type { Tab } from '../learning/types'
import { useI18n } from '../i18n'

export function Brand() {
  return (
    <div className="brand" aria-label="Μελέτη">
      <span className="brand-mark" aria-hidden="true">Ψ</span>
      <span>Μελέτη</span>
    </div>
  )
}

export function NavItems({
  active,
  onChange,
}: {
  active: Tab
  onChange: (t: Tab) => void
}) {
  const { t } = useI18n()
  return (
    <div className="nav-items">
      {(['today', 'library', 'progress'] as const).map((tab) => (
        <button
          key={tab}
          className={'nav-item' + (active === tab ? ' nav-item--active' : '')}
          aria-current={active === tab ? 'page' : undefined}
          onClick={() => onChange(tab)}
        >
          <span className="nav-icon" aria-hidden="true">
            {tab === 'today' ? '●' : tab === 'library' ? '▤' : '↗'}
          </span>
          <span>{t(tab)}</span>
        </button>
      ))}
    </div>
  )
}

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n()
  return (
    <div
      className={'language-toggle' + (compact ? ' language-toggle--compact' : '')}
      role="group"
      aria-label={t('language')}
    >
      <button
        type="button"
        className={'language-option' + (locale === 'en' ? ' language-option--active' : '')}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
        title={t('english')}
      >
        EN
      </button>
      <button
        type="button"
        className={'language-option' + (locale === 'el' ? ' language-option--active' : '')}
        aria-pressed={locale === 'el'}
        onClick={() => setLocale('el')}
        title={t('greek')}
      >
        ΕΛ
      </button>
    </div>
  )
}
