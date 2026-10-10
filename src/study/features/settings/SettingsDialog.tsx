import { Dialog } from '../../components/Dialog'
import { LanguageToggle } from '../../components/Primitives'
import { useI18n } from '../../i18n'
import { SettingsForm } from './SettingsForm'
import type { StudySettings } from '../../learning/types'
export function SettingsDialog({
  settings,
  onSave,
  onClose,
}: {
  settings: StudySettings
  onSave: (s: StudySettings) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  return (
    <Dialog title={t('settings')} onClose={onClose}>
      <section className="settings-section settings-section--first">
        <div className="settings-language-row">
          <div>
            <h3>{t('languageContent')}</h3>
            <p className="muted settings-copy">{t('languageHelp')}</p>
          </div>
          <LanguageToggle />
        </div>
      </section>
      <section className="settings-section">
        <h3>{t('studyPlan')}</h3>
        <SettingsForm
          initial={settings}
          onSave={onSave}
          submitLabel={t('saveSettings')}
        />
      </section>
      <section className="settings-section">
        <h3>{t('studyCloudTitle')}</h3>
        <p>{t('studyCloudHelp')}</p>
      </section>
      <p className="muted">{t('disclaimer')}</p>
    </Dialog>
  )
}
