import { useState, type FormEvent } from 'react'
import type { StudySettings } from '../../learning/types'
import { useI18n } from '../../i18n'
export function SettingsForm({
  initial,
  onSave,
  submitLabel,
}: {
  initial: StudySettings
  onSave: (s: StudySettings) => void
  submitLabel?: string
}) {
  const { t } = useI18n()
  const [minutes, setMinutes] = useState(
    initial.dailyTargetMinutes?.toString() ?? '',
  )
  const [limit, setLimit] = useState(initial.dailyNewLimit?.toString() ?? '')
  const [shuffle, setShuffle] = useState(initial.shuffleQuestions ?? false)
  const [order, setOrder] = useState(initial.reviewOrder ?? 'oldest')
  const [repetition, setRepetition] = useState(initial.repetition ?? 'balanced')
  const [shortcuts, setShortcuts] = useState(initial.keyboardShortcuts ?? true)
  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      dailyNewLimit: limit.trim() ? Number(limit) : undefined,
      shuffleQuestions: shuffle,
      reviewOrder: order,
      repetition,
      keyboardShortcuts: shortcuts,
      dailyTargetMinutes: minutes.trim() ? Number(minutes) : undefined,
    })
  }
  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        {t('dailyTarget')} <span className="muted">{t('optional')}</span>
        <input
          type="number"
          min={5}
          max={600}
          step={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder={t('noTimeCap')}
        />
      </label>
      <p className="muted">{t('dueIncluded')}</p>
      <button className="primary-button" type="submit">
        {submitLabel ?? t('saveSettings')}
      </button>
      <details className="section">
        <summary>{t('prefsTitle')}</summary>
        <label>
          {t('prefsNewLimit')}
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder={t('prefsNewPlaceholder')}
          />
        </label>
        <p className="muted">
          {t('prefsNewHelp')}
        </p>
        <label htmlFor="review-order">{t('prefsOrder')}</label>
        <select
          id="review-order"
          value={order}
          onChange={(e) => setOrder(e.target.value as typeof order)}
        >
          <option value="oldest">{t('prefsOldest')}</option>
          <option value="weakest">{t('prefsWeakest')}</option>
        </select>
        <label htmlFor="repetition">{t('prefsIntensity')}</label>
        <select
          id="repetition"
          value={repetition}
          onChange={(e) => setRepetition(e.target.value as typeof repetition)}
        >
          <option value="light">{t('prefsLight')}</option>
          <option value="balanced">{t('prefsBalanced')}</option>
          <option value="intensive">{t('prefsIntensive')}</option>
        </select>
        <p className="muted">
          {t('prefsFuture')}
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={(e) => setShuffle(e.target.checked)}
          />{' '}
          {t('prefsShuffle')}
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={shortcuts}
            onChange={(e) => setShortcuts(e.target.checked)}
          />{' '}
          {t('prefsShortcuts')}
        </label>
      </details>
    </form>
  )
}
