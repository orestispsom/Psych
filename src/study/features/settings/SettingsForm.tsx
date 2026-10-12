import { useState, type FormEvent } from 'react'
import type { StudySettings } from '../../learning/types'
import { useI18n } from '../../i18n'
export function SettingsForm({ initial, onSave, submitLabel }: {
  initial: StudySettings
  onSave: (s: StudySettings) => void
  submitLabel?: string
}) {
  const { t, locale } = useI18n()
  const [shuffle, setShuffle] = useState(initial.shuffleQuestions ?? false)
  const [repetition, setRepetition] = useState(initial.repetition ?? 'balanced')
  const [shortcuts, setShortcuts] = useState(initial.keyboardShortcuts ?? true)
  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({ shuffleQuestions: shuffle, repetition, keyboardShortcuts: shortcuts })
  }
  return <form className="settings-form" onSubmit={submit}>
    <label htmlFor="repetition">{t('prefsIntensity')}</label>
    <select id="repetition" value={repetition}
      onChange={e => setRepetition(e.target.value as typeof repetition)}>
      <option value="light">{t('prefsLight')}</option>
      <option value="balanced">{t('prefsBalanced')}</option>
      <option value="intensive">{t('prefsIntensive')}</option>
    </select>
    <p className="muted">{locale === 'el'
      ? 'Αφορά τον προγραμματισμό μελλοντικών αξιολογήσεων, όχι τις ήδη καταχωρισμένες.'
      : 'Affects future ratings, not existing scheduled reviews.'}</p>
    <label className="checkbox-label">
      <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} />
      {' '}{t('prefsShuffle')}
    </label>
    <label className="checkbox-label">
      <input type="checkbox" checked={shortcuts} onChange={e => setShortcuts(e.target.checked)} />
      {' '}{t('prefsShortcuts')}
    </label>
    <button className="primary-button" type="submit">{submitLabel ?? t('saveSettings')}</button>
  </form>
}
